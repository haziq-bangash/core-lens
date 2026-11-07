'use client';

import { useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { CoreLensLogo } from '@/components/logos/core-lens-logo';
import { cn } from '@/lib/utils';

const WORD = 'CoreLens';
const EASE = [0.22, 1, 0.36, 1] as const;

// Play the intro once per page load. Returning to the home screen via client-side
// navigation shows the finished wordmark instead of replaying it.
let hasPlayed = false;

/**
 * Logo -> wordmark intro: the mark springs in on its own, then the name is "written"
 * out beside it, letter by letter, as the mark slides left to make room.
 */
export function AnimatedWordmark({ className }: { className?: string }) {
  const reduceMotion = useReducedMotion();
  const skip = reduceMotion || hasPlayed;

  useEffect(() => {
    hasPlayed = true;
  }, []);

  return (
    <h1
      aria-label={WORD}
      className={cn('inline-flex items-center text-foreground font-light tracking-tighter', className)}
    >
      <motion.span
        aria-hidden
        className="flex shrink-0"
        initial={skip ? false : { opacity: 0, scale: 0.4, rotate: -25 }}
        animate={{ opacity: 1, scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 220, damping: 16 }}
      >
        <CoreLensLogo className="h-[0.8em] w-auto" />
      </motion.span>

      <motion.span
        aria-hidden
        className="inline-flex overflow-hidden whitespace-nowrap py-[0.15em] -my-[0.15em]"
        initial={skip ? false : { width: 0, marginLeft: 0 }}
        animate={{ width: 'auto', marginLeft: '0.3em' }}
        transition={{ delay: 0.55, duration: 0.9, ease: EASE }}
      >
        {WORD.split('').map((char, i) => (
          <motion.span
            key={i}
            className="inline-block"
            initial={skip ? false : { opacity: 0, y: '0.35em', filter: 'blur(8px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ delay: 0.65 + i * 0.055, duration: 0.55, ease: EASE }}
          >
            {char}
          </motion.span>
        ))}
      </motion.span>
    </h1>
  );
}
