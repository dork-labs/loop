'use client';

import { motion } from 'motion/react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { AGENTS } from '../lib/agents';
import { REVEAL, STAGGER, VIEWPORT } from '../lib/motion-variants';

/** Display the first 6 agents from the AGENTS array. */
const FEATURED_AGENTS = AGENTS.slice(0, 6);

/**
 * Full-width strip showcasing supported AI agent platforms.
 *
 * Displays logos for the first 6 agents in monochrome warm-gray with
 * staggered scroll-triggered entrance animations. Matches the visual
 * pattern of IntegrationsBar.
 */
export function AgentPlatforms() {
  return (
    <section id="integrations" className="bg-cream-secondary px-8 py-16">
      <motion.div
        className="mx-auto max-w-2xl text-center"
        initial="hidden"
        whileInView="visible"
        viewport={VIEWPORT}
        variants={STAGGER}
      >
        <motion.p
          variants={REVEAL}
          className="text-2xs text-brand-orange mb-10 text-center font-mono tracking-[0.2em] uppercase"
        >
          Agent Integrations
        </motion.p>

        <motion.div
          variants={REVEAL}
          className="mb-10 flex flex-wrap items-center justify-center gap-8"
        >
          {FEATURED_AGENTS.map(({ id, name, Logo }) => (
            <div key={id} className="flex flex-col items-center gap-3" aria-label={name}>
              <Logo />
              <span className="text-2xs text-warm-gray-light font-mono tracking-[0.15em] uppercase">
                {name}
              </span>
            </div>
          ))}
        </motion.div>

        <motion.p variants={REVEAL} className="text-warm-gray mb-6 text-sm leading-[1.7] font-light">
          Works with every AI coding agent.
        </motion.p>

        <motion.div variants={REVEAL}>
          <Link
            href="/integrations"
            className="text-brand-orange hover:text-brand-orange/80 inline-flex items-center gap-1.5 text-sm font-mono tracking-[0.1em] transition-colors uppercase"
          >
            View all integrations
            <ArrowRight size={14} />
          </Link>
        </motion.div>
      </motion.div>
    </section>
  );
}
