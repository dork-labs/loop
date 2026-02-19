'use client'

import Link from 'next/link'
import { motion } from 'motion/react'
import { siteConfig } from '@/config/site'
import { REVEAL, STAGGER } from '../lib/motion-variants'

/**
 * Loop hero section -- minimal, brand-forward with "Coming Soon" CTA.
 *
 * Centered layout with the Loop tagline, a brief description,
 * and a waitlist/contact call-to-action.
 */
export function LoopHero() {
  return (
    <section className="relative min-h-[85vh] bg-cream-primary flex flex-col items-center justify-center px-6 py-24 overflow-hidden">
      {/* Subtle graph-paper background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(139, 90, 43, 0.05) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(139, 90, 43, 0.05) 1px, transparent 1px)
          `,
          backgroundSize: '32px 32px',
          maskImage:
            'linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)',
          WebkitMaskImage:
            'linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)',
        }}
      />

      <motion.div
        className="relative z-10 max-w-2xl mx-auto text-center"
        initial="hidden"
        animate="visible"
        variants={STAGGER}
      >
        {/* Eyebrow */}
        <motion.p
          variants={REVEAL}
          className="font-mono text-2xs tracking-[0.2em] uppercase text-brand-orange mb-8"
        >
          Coming Soon
        </motion.p>

        {/* Headline */}
        <motion.h1
          variants={REVEAL}
          className="font-bold text-charcoal tracking-[-0.04em] text-balance mb-6"
          style={{ fontSize: 'clamp(36px, 6vw, 72px)', lineHeight: 1.06 }}
        >
          Loop
        </motion.h1>

        {/* Tagline */}
        <motion.p
          variants={REVEAL}
          className="font-mono text-sm tracking-[0.08em] uppercase text-warm-gray-light mb-10"
        >
          {siteConfig.tagline}
        </motion.p>

        {/* Description */}
        <motion.p
          variants={REVEAL}
          className="text-warm-gray font-light leading-[1.75] max-w-lg mx-auto mb-12"
          style={{ fontSize: 'clamp(15px, 1.5vw, 18px)' }}
        >
          An autonomous engine that continuously analyzes your codebase,
          identifies improvements, and executes them — so your software gets
          better while you sleep.
        </motion.p>

        {/* CTA group */}
        <motion.div
          variants={REVEAL}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <a
            href={`mailto:${siteConfig.contactEmail}?subject=Loop%20Waitlist`}
            className="marketing-btn inline-flex items-center gap-2"
            style={{
              background: '#E85D04',
              color: '#FFFEFB',
            }}
          >
            Join the waitlist
            <span className="cursor-blink" aria-hidden="true" />
          </a>

          <Link
            href={siteConfig.github}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 font-mono text-button tracking-[0.08em] text-warm-gray-light hover:text-brand-orange transition-smooth"
          >
            View on GitHub
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M2.5 6h7M6.5 3l3 3-3 3"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
        </motion.div>
      </motion.div>
    </section>
  )
}
