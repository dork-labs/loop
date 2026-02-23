'use client';

import Link from 'next/link';
import { motion } from 'motion/react';
import { siteConfig } from '@/config/site';
import { REVEAL, STAGGER } from '../lib/motion-variants';
import { FeedbackLoopDiagram } from './FeedbackLoopDiagram';

/**
 * Loop hero section — split-panel layout with animated SVG feedback loop diagram.
 *
 * Left panel: eyebrow, headline, subhead, and CTAs.
 * Right panel: SVG diagram of the 5-node feedback loop (Signal → Issue → Prompt → Dispatch → Outcome).
 *
 * LCP note: h1 is rendered immediately without opacity:0 so the browser can
 * identify it as the LCP candidate. Only secondary elements use REVEAL animations.
 */
export function LoopHero() {
  return (
    <section className="bg-cream-primary relative overflow-hidden">
      {/* Graph-paper background */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(139, 90, 43, 0.05) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(139, 90, 43, 0.05) 1px, transparent 1px)
          `,
          backgroundSize: '32px 32px',
          maskImage:
            'linear-gradient(to bottom, transparent 0%, black 10%, black 90%, transparent 100%)',
          WebkitMaskImage:
            'linear-gradient(to bottom, transparent 0%, black 10%, black 90%, transparent 100%)',
        }}
      />

      {/* Split-panel grid */}
      <div className="relative z-10 mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-6 py-20 lg:grid-cols-2 lg:gap-16 lg:py-28">
        {/* Left panel — text content */}
        <motion.div initial="hidden" animate="visible" variants={STAGGER} className="flex flex-col">
          {/* Eyebrow */}
          <motion.p
            variants={REVEAL}
            className="text-2xs text-brand-orange mb-8 font-mono tracking-[0.2em] uppercase"
          >
            Open source
          </motion.p>

          {/*
           * LCP element: h1 is NOT wrapped in a REVEAL variant (which starts at opacity:0).
           * It renders immediately so the browser can paint it as the LCP candidate.
           */}
          <h1
            className="text-charcoal mb-6 font-bold tracking-[-0.04em] text-balance"
            style={{ fontSize: 'clamp(32px, 5.5vw, 64px)', lineHeight: 1.05 }}
          >
            Close the feedback loop on AI-powered development.
          </h1>

          {/* Subhead */}
          <motion.p
            variants={REVEAL}
            className="text-warm-gray mb-10 max-w-lg leading-[1.75] font-light"
            style={{ fontSize: 'clamp(15px, 1.4vw, 18px)' }}
          >
            Loop collects signals from your stack — errors, metrics, user feedback — organizes them
            into prioritized issues, and tells your agents exactly what to fix next.
          </motion.p>

          {/* CTA group */}
          <motion.div variants={REVEAL} className="flex flex-col items-start gap-4 sm:flex-row">
            <Link
              href="/docs/getting-started/quickstart"
              className="marketing-btn inline-flex items-center gap-2"
              style={{ background: '#E85D04', color: '#FFFEFB' }}
            >
              <span className="hidden sm:inline">Read the docs</span>
              <span className="sm:hidden">Get started</span>
              <span className="cursor-blink" aria-hidden="true" />
            </Link>

            <Link
              href={siteConfig.github}
              target="_blank"
              rel="noopener noreferrer"
              className="text-button text-warm-gray-light hover:text-brand-orange transition-smooth inline-flex items-center gap-1.5 font-mono tracking-[0.08em]"
            >
              View on GitHub
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
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

          {/* Install hint */}
          <motion.p variants={REVEAL} className="text-2xs text-warm-gray-light mt-4 font-mono">
            npm install -g looped
          </motion.p>
        </motion.div>

        {/* Right panel — SVG feedback loop diagram */}
        <div className="flex items-center justify-center lg:justify-end">
          <FeedbackLoopDiagram />
        </div>
      </div>
    </section>
  );
}
