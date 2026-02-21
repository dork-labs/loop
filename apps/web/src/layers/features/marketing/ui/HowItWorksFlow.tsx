'use client'

import { motion } from 'motion/react'
import { Zap, ClipboardList, FileText, Send, type LucideIcon } from 'lucide-react'
import { REVEAL, STAGGER, VIEWPORT } from '../lib/motion-variants'

interface FlowStep {
  icon: LucideIcon
  label: string
  title: string
  description: string
}

const FLOW_STEPS: FlowStep[] = [
  {
    icon: Zap,
    label: '01 / Signal',
    title: 'Capture Signals',
    description:
      'Errors, metrics, and feedback flow in from Sentry, PostHog, GitHub, and custom sources — automatically tagged and normalized.',
  },
  {
    icon: ClipboardList,
    label: '02 / Issue',
    title: 'Organize Issues',
    description:
      'Signals are deduplicated, prioritized, and turned into structured issues with context, severity, and reproduction steps.',
  },
  {
    icon: FileText,
    label: '03 / Prompt',
    title: 'Generate Prompts',
    description:
      'Each issue is rendered into a precise, versioned prompt that gives AI agents the exact context they need to act.',
  },
  {
    icon: Send,
    label: '04 / Dispatch',
    title: 'Dispatch & Close',
    description:
      'Prompts are dispatched to your AI agent of choice. Results are reviewed, merged, and the loop closes automatically.',
  },
]

/** Horizontal arrow connector shown between steps on desktop. */
function HorizontalConnector() {
  return (
    <div className="hidden md:flex items-center flex-shrink-0 w-12" aria-hidden="true">
      <div
        className="w-full h-px"
        style={{ background: 'rgba(139, 90, 43, 0.2)' }}
      />
      <svg
        width="8"
        height="8"
        viewBox="0 0 8 8"
        fill="none"
        className="flex-shrink-0 -ml-px"
        style={{ color: 'rgba(139, 90, 43, 0.35)' }}
      >
        <path
          d="M1 4h6M4.5 1.5L7 4l-2.5 2.5"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  )
}

/** Vertical arrow connector shown between steps on mobile. */
function VerticalConnector() {
  return (
    <div className="flex md:hidden flex-col items-center h-10" aria-hidden="true">
      <div
        className="flex-1 w-px"
        style={{ background: 'rgba(139, 90, 43, 0.2)' }}
      />
      <svg
        width="8"
        height="8"
        viewBox="0 0 8 8"
        fill="none"
        className="flex-shrink-0 -mt-px"
        style={{ color: 'rgba(139, 90, 43, 0.35)' }}
      >
        <path
          d="M4 1v6M1.5 4.5L4 7l2.5-2.5"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  )
}

interface StepCardProps {
  step: FlowStep
  index: number
}

/** Individual step card with icon, label, title, and description. */
function StepCard({ step, index }: StepCardProps) {
  const Icon = step.icon

  return (
    <motion.div
      variants={REVEAL}
      className="flex flex-col gap-4 md:flex-1"
      style={{ minWidth: 0 }}
    >
      {/* Icon container */}
      <div className="flex items-center gap-3">
        <div
          className="flex items-center justify-center w-10 h-10 rounded-lg flex-shrink-0"
          style={{
            background: index === 0 ? 'rgba(232, 93, 4, 0.1)' : 'rgba(139, 90, 43, 0.08)',
            border: '1px solid rgba(139, 90, 43, 0.15)',
          }}
        >
          <Icon
            size={18}
            style={{ color: index === 0 ? '#E85D04' : '#7A756A' }}
            strokeWidth={1.5}
          />
        </div>
        <span
          className="font-mono text-2xs tracking-[0.15em] uppercase"
          style={{ color: '#7A756A' }}
        >
          {step.label}
        </span>
      </div>

      {/* Text content */}
      <div>
        <h3
          className="text-charcoal font-semibold text-base mb-2 tracking-[-0.02em]"
        >
          {step.title}
        </h3>
        <p className="text-warm-gray font-light leading-[1.7] text-sm">
          {step.description}
        </p>
      </div>
    </motion.div>
  )
}

/**
 * How It Works flow section — four-step signal-to-dispatch pipeline.
 *
 * Horizontal layout on desktop with arrow connectors between steps,
 * vertical layout on mobile. Entrance animations use STAGGER + REVEAL.
 */
export function HowItWorksFlow() {
  return (
    <section id="how-it-works" className="py-24 px-8 bg-cream-primary">
      <motion.div
        className="max-w-5xl mx-auto"
        initial="hidden"
        whileInView="visible"
        viewport={VIEWPORT}
        variants={STAGGER}
      >
        {/* Section label */}
        <motion.p
          variants={REVEAL}
          className="font-mono text-2xs tracking-[0.2em] uppercase text-brand-orange text-center mb-16"
        >
          The Loop
        </motion.p>

        {/* Section headline */}
        <motion.h2
          variants={REVEAL}
          className="text-charcoal text-center font-bold tracking-[-0.03em] mb-4"
          style={{ fontSize: 'clamp(24px, 3.5vw, 40px)' }}
        >
          From raw signal to closed loop
        </motion.h2>

        <motion.p
          variants={REVEAL}
          className="text-warm-gray font-light leading-[1.75] text-center max-w-xl mx-auto mb-20"
          style={{ fontSize: 'clamp(14px, 1.25vw, 16px)' }}
        >
          Four automated steps turn noise into resolved issues — no manual triage required.
        </motion.p>

        {/* Flow steps — horizontal on desktop, vertical on mobile */}
        <div className="flex flex-col md:flex-row md:items-start gap-0">
          {FLOW_STEPS.map((step, index) => (
            <div
              key={step.label}
              className="flex flex-col md:flex-row md:items-start md:flex-1 min-w-0"
            >
              <StepCard step={step} index={index} />
              {index < FLOW_STEPS.length - 1 && (
                <>
                  <HorizontalConnector />
                  <VerticalConnector />
                </>
              )}
            </div>
          ))}
        </div>
      </motion.div>
    </section>
  )
}
