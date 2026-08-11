-- memo_categories: 1-level subcategory via parent_id
-- Policy A: ON DELETE SET NULL (children promoted to root)
-- memos.category_id unchanged (may point to root or leaf)
-- Live baseline columns: id, user_id, name, sort_order, created_at, updated_at
--
-- BEFORE running: ensure no duplicate (user_id, name) among roots:
--   SELECT user_id, name, count(*) AS cnt
--   FROM memo_categories
--   GROUP BY user_id, name
--   HAVING count(*) > 1;

BEGIN;

-- 1) parent_id (NULL = root; existing rows stay roots)
ALTER TABLE memo_categories
  ADD COLUMN IF NOT EXISTS parent_id UUID NULL;

-- 2) self FK: parent delete → child.parent_id = NULL
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'memo_categories_parent_id_fkey'
  ) THEN
    ALTER TABLE memo_categories
      ADD CONSTRAINT memo_categories_parent_id_fkey
      FOREIGN KEY (parent_id)
      REFERENCES memo_categories(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- 3) indexes
CREATE INDEX IF NOT EXISTS memo_categories_parent_id_idx
  ON memo_categories(parent_id);

CREATE INDEX IF NOT EXISTS memo_categories_user_parent_sort_idx
  ON memo_categories(user_id, parent_id, sort_order);

-- 4) parent must belong to same user
CREATE OR REPLACE FUNCTION memo_categories_parent_same_user()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM memo_categories p
    WHERE p.id = NEW.parent_id
      AND p.user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'parent_id must reference a category owned by the same user';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_memo_categories_parent_same_user ON memo_categories;
CREATE TRIGGER trg_memo_categories_parent_same_user
  BEFORE INSERT OR UPDATE OF parent_id, user_id
  ON memo_categories
  FOR EACH ROW
  EXECUTE FUNCTION memo_categories_parent_same_user();

-- 5) one-level hierarchy only
CREATE OR REPLACE FUNCTION memo_categories_enforce_one_level()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  parent_parent UUID;
BEGIN
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.id IS NOT NULL AND NEW.parent_id = NEW.id THEN
    RAISE EXCEPTION 'category cannot be its own parent';
  END IF;

  SELECT p.parent_id INTO parent_parent
  FROM memo_categories p
  WHERE p.id = NEW.parent_id;

  IF parent_parent IS NOT NULL THEN
    RAISE EXCEPTION 'only one subcategory level is allowed (parent must be a root)';
  END IF;

  -- INSERT: NEW.id may be null until default; skip child-check when id unknown
  IF NEW.id IS NOT NULL AND EXISTS (
    SELECT 1 FROM memo_categories c WHERE c.parent_id = NEW.id
  ) THEN
    RAISE EXCEPTION 'a parent category cannot become a subcategory';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_memo_categories_one_level ON memo_categories;
CREATE TRIGGER trg_memo_categories_one_level
  BEFORE INSERT OR UPDATE OF parent_id
  ON memo_categories
  FOR EACH ROW
  EXECUTE FUNCTION memo_categories_enforce_one_level();

-- 6) unique name per user per parent (sentinel for NULL parent)
CREATE UNIQUE INDEX IF NOT EXISTS memo_categories_user_parent_name_uidx
  ON memo_categories (
    user_id,
    (COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid)),
    name
  );

COMMIT;
