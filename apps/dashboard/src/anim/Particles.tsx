import { useEffect, useRef } from 'react';
import { useReducedMotion } from 'framer-motion';
import confetti from 'canvas-confetti';

/** Each node owns its canvas, so celebrations stay clipped to its circle. */
export function Particles({ active }: { active: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (!active || reducedMotion || !canvas.current) return;
    const burst = confetti.create(canvas.current, { resize: true, useWorker: false });
    void burst({
      particleCount: 22,
      spread: 360,
      startVelocity: 7,
      gravity: 0.3,
      ticks: 45,
      scalar: 0.4,
      origin: { x: 0.5, y: 0.5 },
      colors: ['#ffffff', '#d1fae5', '#fcd778'],
      disableForReducedMotion: true,
    });
    return () => burst.reset();
  }, [active, reducedMotion]);

  return active && !reducedMotion ? <canvas ref={canvas} className="mastery-particles" aria-hidden="true" /> : null;
}
