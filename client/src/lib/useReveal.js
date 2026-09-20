import { useEffect, useRef } from 'react';

/**
 * The staggered entrance, driven by one IntersectionObserver rather than an
 * animation library. Children of the returned ref get `.rise` plus a delay
 * class when the container first scrolls into view, and `will-change` is
 * dropped once the run finishes.
 *
 * Elements are never parked at opacity:0 with no way back — if the observer
 * is unavailable, everything is simply revealed.
 */
export function useReveal({ selector = ':scope > *', stagger = 0.15, max = 5 } = {}) {
  const ref = useRef(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;

    const children = Array.from(root.querySelectorAll(selector));
    if (!children.length) return;

    const reveal = () => {
      children.forEach((child, i) => {
        child.style.animationDelay = `${Math.min(i, max) * stagger}s, ${
          Math.min(i, max) * stagger
        }s`;
        child.classList.add('rise');
        child.addEventListener(
          'animationend',
          () => {
            child.style.willChange = 'auto';
          },
          { once: true }
        );
      });
    };

    if (typeof IntersectionObserver === 'undefined') {
      reveal();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          reveal();
          observer.disconnect();
        }
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.05 }
    );

    observer.observe(root);
    return () => observer.disconnect();
  }, [selector, stagger, max]);

  return ref;
}
