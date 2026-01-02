-- Add deleted_at column to routine_templates for soft delete
-- This prevents orphaning historical daily_routine_checks when a template is removed in UI.

BEGIN;

ALTER TABLE routine_templates
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_routine_templates_user_deleted_at
ON routine_templates(user_id, deleted_at);

COMMIT;


