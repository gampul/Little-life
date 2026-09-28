import { Node, mergeAttributes } from '@tiptap/core';

/**
 * 링크 북마크 카드 (노션 북마크 블록과 비슷한 형태)
 *
 * 저장 HTML — 상세 화면(dangerouslySetInnerHTML)에서도 JS 없이 CSS(.bookmark-card)만으로 렌더된다.
 *   <a data-type="bookmark" class="bookmark-card" href="…" data-title data-description data-image data-site>
 *     <span class="bookmark-card__body">
 *       <span class="bookmark-card__title">제목</span>
 *       <span class="bookmark-card__desc">설명</span>
 *       <span class="bookmark-card__url">사이트 · 도메인</span>
 *     </span>
 *     <span class="bookmark-card__thumb"><img src="…"></span>
 *   </a>
 */

export type BookmarkAttrs = {
  href: string;
  title?: string | null;
  description?: string | null;
  image?: string | null;
  site?: string | null;
};

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    bookmark: {
      setBookmark: (attrs: BookmarkAttrs) => ReturnType;
    };
  }
}

const safeHttpUrl = (value: string | null | undefined): string | null => {
  if (!value) return null;
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : null;
  } catch {
    return null;
  }
};

export const displayHost = (href: string): string => {
  try {
    const u = new URL(href);
    const path = u.pathname === '/' ? '' : u.pathname;
    return `${u.hostname.replace(/^www\./, '')}${path}`.slice(0, 80);
  } catch {
    return href.slice(0, 80);
  }
};

const Bookmark = Node.create({
  name: 'bookmark',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      href: { default: null, parseHTML: (el) => el.getAttribute('href') },
      title: { default: null, parseHTML: (el) => el.getAttribute('data-title') },
      description: { default: null, parseHTML: (el) => el.getAttribute('data-description') },
      image: { default: null, parseHTML: (el) => el.getAttribute('data-image') },
      site: { default: null, parseHTML: (el) => el.getAttribute('data-site') },
    };
  },

  parseHTML() {
    return [{ tag: 'a[data-type="bookmark"]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const href = safeHttpUrl(node.attrs.href) || '#';
    const image = safeHttpUrl(node.attrs.image);
    const title: string = node.attrs.title || displayHost(href);
    const description: string | null = node.attrs.description || null;
    const host = displayHost(href);
    const site: string | null = node.attrs.site || null;
    const urlLine = site && !host.startsWith(site) ? `${site} · ${host}` : host;

    const body: unknown[] = ['span', { class: 'bookmark-card__body' }, ['span', { class: 'bookmark-card__title' }, title]];
    if (description) body.push(['span', { class: 'bookmark-card__desc' }, description]);
    body.push(['span', { class: 'bookmark-card__url' }, urlLine]);

    const children: unknown[] = [body];
    if (image) {
      children.push([
        'span',
        { class: 'bookmark-card__thumb' },
        ['img', { src: image, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' }],
      ]);
    }

    return [
      'a',
      mergeAttributes(
        {
          // 에디터 전용 속성(contenteditable 등)만 합치고, 아래 값이 최종
          ...Object.fromEntries(Object.entries(HTMLAttributes).filter(([k]) => !['href', 'title', 'description', 'image', 'site'].includes(k))),
        },
        {
          'data-type': 'bookmark',
          class: `bookmark-card${image ? ' bookmark-card--thumb' : ''}`,
          href,
          target: '_blank',
          rel: 'noopener noreferrer nofollow',
          'data-title': node.attrs.title || null,
          'data-description': description,
          'data-image': image,
          'data-site': site,
        }
      ),
      ...children,
    ] as never;
  },

  addCommands() {
    return {
      setBookmark:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs }),
    };
  },
});

export default Bookmark;
