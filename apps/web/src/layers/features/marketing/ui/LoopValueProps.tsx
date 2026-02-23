'use client';

import { motion } from 'motion/react';
import { REVEAL, STAGGER, VIEWPORT } from '../lib/motion-variants';

interface ValueProp {
  label: string;
  title: string;
  description: string;
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
];

/**
 * Value proposition section -- four product pillars of the Loop engine.
 *
 * Displays Data Layer / Prompt Engine / Dashboard / CLI as a staggered
 * card grid with scroll-triggered entrance animations.
 */
export function LoopValueProps() {
  return (
    <section id="features" className="bg-cream-secondary px-8 py-24">
      <motion.div
        className="mx-auto max-w-6xl"
        initial="hidden"
        whileInView="visible"
        viewport={VIEWPORT}
        variants={STAGGER}
      >
        <motion.p
          variants={REVEAL}
          className="text-2xs text-brand-orange mb-16 text-center font-mono tracking-[0.2em] uppercase"
        >
          What you get
        </motion.p>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {VALUE_PROPS.map((prop) => (
            <motion.div
              key={prop.label}
              variants={REVEAL}
              className="bg-cream-white rounded-lg border border-[var(--border-warm)] p-6"
            >
              <span className="text-2xs text-warm-gray mb-3 block font-mono tracking-[0.15em] uppercase">
                {prop.label}
              </span>
              <h3 className="text-charcoal mb-3 text-lg font-semibold tracking-[-0.02em]">
                {prop.title}
              </h3>
              <p className="text-warm-gray text-sm leading-[1.7] font-light">{prop.description}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </section>
  );
}
