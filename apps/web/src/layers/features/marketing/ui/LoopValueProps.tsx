'use client'

import { motion } from 'motion/react'
import { REVEAL, STAGGER, VIEWPORT } from '../lib/motion-variants'

interface ValueProp {
  label: string
  title: string
  description: string
}

const VALUE_PROPS: ValueProp[] = [
  {
    label: 'Data Layer',
    title: 'Signal Ingestion & Issue Management',
    description:
      'PostgreSQL-backed data layer with 10 entity types. Ingest signals from PostHog, GitHub, and Sentry. Full CRUD API with filtering, pagination, and hierarchy.',
  },
  {
    label: 'Prompt Engine',
    title: 'Template Selection & Hydration',
    description:
      'Conditions-based template matching with Handlebars hydration. Injects full system context — issues, projects, goals, relations — into agent prompts.',
  },
  {
    label: 'Dashboard',
    title: 'Real-Time Oversight',
    description:
      'React dashboard with 5 views: Issues, Issue Detail, Activity Timeline, Goals, and Prompt Health. Monitor the autonomous loop in real time.',
  },
  {
    label: 'CLI',
    title: 'Command-Line Control',
    description:
      '13 commands for issue management, signals, triage, dispatch, templates, and system status. JSON output for scripting.',
  },
]

/**
 * Value proposition section -- four product pillars of the Loop engine.
 *
 * Displays Data Layer / Prompt Engine / Dashboard / CLI as a staggered
 * card grid with scroll-triggered entrance animations.
 */
export function LoopValueProps() {
  return (
    <section id="features" className="py-24 px-8 bg-cream-secondary">
      <motion.div
        className="max-w-6xl mx-auto"
        initial="hidden"
        whileInView="visible"
        viewport={VIEWPORT}
        variants={STAGGER}
      >
        <motion.p
          variants={REVEAL}
          className="font-mono text-2xs tracking-[0.2em] uppercase text-brand-orange text-center mb-16"
        >
          What you get
        </motion.p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {VALUE_PROPS.map((prop) => (
            <motion.div
              key={prop.label}
              variants={REVEAL}
              className="bg-cream-white rounded-lg p-6 border border-[var(--border-warm)]"
            >
              <span className="font-mono text-2xs tracking-[0.15em] uppercase block mb-3 text-warm-gray">
                {prop.label}
              </span>
              <h3 className="text-charcoal font-semibold text-lg mb-3 tracking-[-0.02em]">
                {prop.title}
              </h3>
              <p className="text-warm-gray font-light leading-[1.7] text-sm">
                {prop.description}
              </p>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </section>
  )
}
