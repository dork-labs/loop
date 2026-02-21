'use client'

import Link from 'next/link'
import { motion } from 'motion/react'
import { REVEAL, STAGGER, VIEWPORT } from '../lib/motion-variants'

const CLI_COMMANDS = [
  'npm install -g looped',
  'looped config set url https://your-loop-instance.com',
  'looped config set token tok_your_api_key',
  'looped list',
] as const

/**
 * Quick start section — terminal-style CLI onboarding for the marketing page.
 *
 * Shows the four commands needed to get up and running, with a link to
 * the full setup guide in the docs. Entrance animation uses whileInView
 * with REVEAL variants; the code block itself is static to prevent CLS.
 */
export function QuickStartSection() {
  return (
    <section id="get-started" className="py-24 px-8 bg-cream-tertiary">
      <motion.div
        className="max-w-2xl mx-auto"
        initial="hidden"
        whileInView="visible"
        viewport={VIEWPORT}
        variants={STAGGER}
      >
        <motion.span
          variants={REVEAL}
          className="font-mono text-2xs tracking-[0.15em] uppercase text-brand-orange block text-center mb-10"
        >
          Get started
        </motion.span>

        <motion.h2
          variants={REVEAL}
          className="text-charcoal font-medium text-2xl md:text-3xl tracking-[-0.02em] text-center mb-10"
        >
          Up and running in 60 seconds.
        </motion.h2>

        {/* Static code block — no animation to prevent CLS */}
        <div className="bg-charcoal rounded-lg p-6 mb-6 overflow-x-auto">
          <ol className="space-y-3 list-none">
            {CLI_COMMANDS.map((cmd) => (
              <li key={cmd} className="flex items-start gap-3">
                <span
                  className="font-mono text-sm text-warm-gray-light select-none shrink-0"
                  aria-hidden="true"
                >
                  $
                </span>
                <code className="font-mono text-sm text-cream-primary bg-transparent p-0 break-all">
                  {cmd}
                </code>
              </li>
            ))}
          </ol>
        </div>

        <motion.p
          variants={REVEAL}
          className="text-center text-sm text-warm-gray"
        >
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
  )
}
