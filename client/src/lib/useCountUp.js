import { useEffect, useState } from 'react';

const prefersReducedMotion = () =>
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/**
 * Animates 0 → target with an ease-out curve, driven by rAF so it stays in
 * step with the CSS transitions on the score ring and metric bars.
 *
 * When the OS asks for reduced motion the final value is the *initial* state,
 * so nothing animates and no render is queued from inside the effect.
 */
export function useCountUp(target = 0, { duration = 1400, delay = 200 } = {}) {
    const reduced = prefersReducedMotion();
    const [value, setValue] = useState(reduced ? Number(target) || 0 : 0);

    useEffect(() => {
        const end = Number(target) || 0;
        if (reduced) return;

        let frame;
        let startedAt;

        const tick = (now) => {
            if (startedAt === undefined) startedAt = now;
            const progress = Math.min((now - startedAt) / duration, 1);
            // easeOutCubic
            const eased = 1 - Math.pow(1 - progress, 3);
            setValue(Math.round(end * eased));
            if (progress < 1) frame = requestAnimationFrame(tick);
        };

        const timer = setTimeout(() => {
            frame = requestAnimationFrame(tick);
        }, delay);

        return () => {
            clearTimeout(timer);
            if (frame) cancelAnimationFrame(frame);
        };
    }, [target, duration, delay, reduced]);

    return value;
}
