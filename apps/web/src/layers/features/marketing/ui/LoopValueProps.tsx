'use client'

import { motion } from 'motion/react'
import { REVEAL, STAGGER } from '../lib/motion-variants'

interface ValueProp {
  label: string
  title: string
  description: string
}

const VALUE_PROPS: ValueProp[] = [
  {
    label: 'Analyze',
    title: 'Continuous Codebase Analysis',
    description:
      'Loop scans your repository for patterns, tech debt, and improvement opportunities -- building a deep understanding of your system over time.',
  },
  {
    label: 'Plan',
    title: 'Intelligent Improvement Plans',
    description:
      'Prioritizes changes by impact and risk, generating detailed execution plans that respect your architecture and conventions.',
  },
  {
    label: 'Execute',
    title: 'Autonomous Execution',
    description:
      'Implements improvements autonomously -- refactoring, testing, and validating changes before presenting them for your review.',
  },
]

/**
 * Value proposition section -- three pillars of the Loop engine.
 *
 * Displays the Analyze / Plan / Execute cycle as a simple grid
 * with staggered entrance animations.
 */
export function LoopValueProps() {
  return (
    <section id="about" className="py-24 px-8 bg-cream-secondary">
      <motion.div
        className="max-w-4xl mx-auto"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-100px' }}
        variants={STAGGER}
      >
        <motion.p
          variants={REVEAL}
          className="font-mono text-2xs tracking-[0.2em] uppercase text-brand-orange text-center mb-16"
        >
          How it works
        </motion.p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          {VALUE_PROPS.map((prop) => (
            <motion.div key={prop.label} variants={REVEAL}>
              <span
                className="font-mono text-2xs tracking-[0.15em] uppercase block mb-3"
                style={{ color: '#7A756A' }}
              >
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
