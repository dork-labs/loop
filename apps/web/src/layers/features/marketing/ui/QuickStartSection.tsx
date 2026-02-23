'use client';

import Link from 'next/link';
import { motion } from 'motion/react';
import { REVEAL, STAGGER, VIEWPORT } from '../lib/motion-variants';

const CLI_COMMANDS = [
  'npm install -g looped',
  'looped config set url https://your-loop-instance.com',
  'looped config set token tok_your_api_key',
  'looped list',
] as const;

/**
 * Quick start section — terminal-style CLI onboarding for the marketing page.
 *
 * Shows the four commands needed to get up and running, with a link to
 * the full setup guide in the docs. Entrance animation uses whileInView
 * with REVEAL variants; the code block itself is static to prevent CLS.
 */
export function QuickStartSection() {
  return (
    <section id="get-started" className="bg-cream-tertiary px-8 py-24">
      <motion.div
        className="mx-auto max-w-2xl"
        initial="hidden"
        whileInView="visible"
        viewport={VIEWPORT}
        variants={STAGGER}
      >
        <motion.span
          variants={REVEAL}
          className="text-2xs text-brand-orange mb-10 block text-center font-mono tracking-[0.15em] uppercase"
        >
          Get started
        </motion.span>

        <motion.h2
          variants={REVEAL}
          className="text-charcoal mb-10 text-center text-2xl font-medium tracking-[-0.02em] md:text-3xl"
        >
          Up and running in 60 seconds.
        </motion.h2>

        {/* Static code block — no animation to prevent CLS */}
        <div className="bg-charcoal mb-6 overflow-x-auto rounded-lg p-6">
          <ol className="list-none space-y-3">
            {CLI_COMMANDS.map((cmd) => (
              <li key={cmd} className="flex items-start gap-3">
                <span
                  className="text-warm-gray-light shrink-0 font-mono text-sm select-none"
                  aria-hidden="true"
                >
                  $
                </span>
                <code className="text-cream-primary bg-transparent p-0 font-mono text-sm break-all">
                  {cmd}
                </code>
              </li>
            ))}
          </ol>
        </div>

        <motion.p variants={REVEAL} className="text-warm-gray text-center text-sm">
          Read the{' '}
          <Link
            href="/docs/getting-started/quickstart"
            className="text-brand-orange hover:text-brand-green transition-smooth underline underline-offset-2"
          >
            docs
          </Link>{' '}
          for the full setup guide.
        </motion.p>
      </motion.div>
    </section>
  );
}
