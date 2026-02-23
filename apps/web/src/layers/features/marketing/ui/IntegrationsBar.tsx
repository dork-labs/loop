'use client';

import { motion } from 'motion/react';
import { REVEAL, STAGGER, VIEWPORT } from '../lib/motion-variants';

/** PostHog hedgehog logomark — monochrome warm-gray. */
function PostHogLogo() {
  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="PostHog"
      role="img"
    >
      {/* Hedgehog body */}
      <ellipse cx="20" cy="24" rx="13" ry="9" fill="#7A756A" />
      {/* Head */}
      <circle cx="20" cy="14" r="7" fill="#7A756A" />
      {/* Spines */}
      <line x1="20" y1="7" x2="18" y2="1" stroke="#7A756A" strokeWidth="2" strokeLinecap="round" />
      <line x1="20" y1="7" x2="23" y2="2" stroke="#7A756A" strokeWidth="2" strokeLinecap="round" />
      <line x1="20" y1="7" x2="26" y2="4" stroke="#7A756A" strokeWidth="2" strokeLinecap="round" />
      <line x1="20" y1="7" x2="15" y2="3" stroke="#7A756A" strokeWidth="2" strokeLinecap="round" />
      {/* Eyes */}
      <circle cx="17" cy="14" r="1.5" fill="#F5F0E8" />
      <circle cx="23" cy="14" r="1.5" fill="#F5F0E8" />
      {/* Nose */}
      <ellipse cx="20" cy="18" rx="2" ry="1.2" fill="#5C5750" />
    </svg>
  );
}

/** GitHub Octocat logomark — monochrome warm-gray. */
function GitHubLogo() {
  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 24 24"
      fill="#7A756A"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="GitHub"
      role="img"
    >
      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

/** Sentry shield logomark — monochrome warm-gray. */
function SentryLogo() {
  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Sentry"
      role="img"
    >
      {/* Shield outline */}
      <path
        d="M20 4L6 10v10c0 7.18 5.94 13.9 14 16 8.06-2.1 14-8.82 14-16V10L20 4z"
        fill="#7A756A"
      />
      {/* Inner highlight — S-shape suggestion via negative cutout */}
      <path
        d="M20 11c-2.5 0-4.5 1.8-4.5 4s2 4 4.5 4c1.38 0 2-.6 2-1.5 0-.9-.8-1.5-2-1.5-.83 0-1.5-.56-1.5-1.25S18.17 13.5 19 13.5c2.5 0 4.5 1.8 4.5 4 0 2.76-2.24 4.5-4.5 4.5v2c3.59 0 6.5-2.69 6.5-6.5 0-3.58-2.91-6.5-6.5-6.5z"
        fill="#F5F0E8"
      />
    </svg>
  );
}

const INTEGRATIONS = [
  { id: 'posthog', name: 'PostHog', Logo: PostHogLogo },
  { id: 'github', name: 'GitHub', Logo: GitHubLogo },
  { id: 'sentry', name: 'Sentry', Logo: SentryLogo },
];

/**
 * Full-width strip showing the three built-in signal integrations.
 *
 * Displays PostHog, GitHub, and Sentry logos in monochrome warm-gray
 * with staggered scroll-triggered entrance animations.
 */
export function IntegrationsBar() {
  return (
    <section className="bg-cream-secondary px-8 py-16">
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
          Signal Integrations
        </motion.p>

        <motion.div variants={REVEAL} className="mb-10 flex items-center justify-center gap-12">
          {INTEGRATIONS.map(({ id, name, Logo }) => (
            <div key={id} className="flex flex-col items-center gap-3" aria-label={name}>
              <Logo />
              <span className="text-2xs text-warm-gray-light font-mono tracking-[0.15em] uppercase">
                {name}
              </span>
            </div>
          ))}
        </motion.div>

        <motion.p variants={REVEAL} className="text-warm-gray text-sm leading-[1.7] font-light">
          Ingest signals from the tools your team already uses.
        </motion.p>
      </motion.div>
    </section>
  );
}
