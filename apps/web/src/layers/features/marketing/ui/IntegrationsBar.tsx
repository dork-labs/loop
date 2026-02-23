'use client';

import { SiGithub, SiPosthog, SiSentry } from '@icons-pack/react-simple-icons';
import { motion } from 'motion/react';
import { REVEAL, STAGGER, VIEWPORT } from '../lib/motion-variants';

const ICON_COLOR = '#7A756A';
const ICON_SIZE = 40;

function PostHogLogo() {
  return <SiPosthog color={ICON_COLOR} size={ICON_SIZE} />;
}

function GitHubLogo() {
  return <SiGithub color={ICON_COLOR} size={ICON_SIZE} />;
}

function SentryLogo() {
  return <SiSentry color={ICON_COLOR} size={ICON_SIZE} />;
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
