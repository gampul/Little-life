'use client';

import React, { forwardRef, useCallback, useLayoutEffect, useRef } from 'react';

type Props = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  /** 최소 줄 수 (기본 5) */
  minRows?: number;
};

/**
 * 내용에 맞춰 높이가 늘어나는 textarea — 긴 글도 스크롤 없이 한 번에 보인다.
 * 바깥 컨테이너(모달 본문 등)가 스크롤을 맡는다.
 */
const AutoGrowTextarea = forwardRef<HTMLTextAreaElement, Props>(function AutoGrowTextarea(
  { minRows = 5, value, onChange, style, ...rest },
  forwardedRef
) {
  const innerRef = useRef<HTMLTextAreaElement | null>(null);

  const setRefs = useCallback(
    (el: HTMLTextAreaElement | null) => {
      innerRef.current = el;
      if (typeof forwardedRef === 'function') forwardedRef(el);
      else if (forwardedRef) forwardedRef.current = el;
    },
    [forwardedRef]
  );

  const resize = useCallback(() => {
    const el = innerRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight + (el.offsetHeight - el.clientHeight)}px`;
  }, []);

  // 값이 바뀔 때(입력·날짜 전환으로 다른 메모 로드) 높이 재계산
  useLayoutEffect(resize, [value, resize]);

  // 화면 폭이 바뀌면 줄바꿈이 달라지므로 다시 계산
  useLayoutEffect(() => {
    const el = innerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    let lastWidth = el.clientWidth;
    const ro = new ResizeObserver(() => {
      if (el.clientWidth !== lastWidth) {
        lastWidth = el.clientWidth;
        resize();
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [resize]);

  return (
    <textarea
      ref={setRefs}
      rows={minRows}
      value={value}
      onChange={onChange}
      style={{ overflow: 'hidden', ...style }}
      {...rest}
    />
  );
});

export default AutoGrowTextarea;
