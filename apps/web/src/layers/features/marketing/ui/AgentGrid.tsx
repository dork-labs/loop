'use client';

import { motion } from 'motion/react';
import { AGENTS } from '../lib/agents';
import { REVEAL, STAGGER, VIEWPORT } from '../lib/motion-variants';

// SVG presentation attributes (fill="#7A756A") have lower specificity than CSS class
// selectors, so the hover Tailwind utilities on the <a> override hardcoded fill values
// on all descendant SVG elements without touching agents.tsx.
const AGENT_ITEM_CLASS =
  'group flex flex-col items-center gap-3' +
  ' [&_circle]:duration-200 [&_ellipse]:duration-200 [&_line]:duration-200 [&_path]:duration-200 [&_rect]:duration-200' +
  ' hover:[&_circle]:fill-[#e85d04] hover:[&_ellipse]:fill-[#e85d04] hover:[&_line]:stroke-[#e85d04] hover:[&_path]:fill-[#e85d04] hover:[&_rect]:fill-[#e85d04]';

/**
 * Responsive grid of supported agent platforms.
 *
 * Each item links to its anchor section on the integrations page.
 * Logos are rendered in monochrome warm-gray and transition to brand-orange on hover.
 * Entrance animation uses staggered REVEAL variants triggered on scroll into view.
 */
export function AgentGrid() {
  return (
    <motion.div
      className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-4"
      initial="hidden"
      whileInView="visible"
      viewport={VIEWPORT}
      variants={STAGGER}
    >
      {AGENTS.map(({ id, name, Logo, anchor }) => (
        <motion.a key={id} href={`#${anchor}`} variants={REVEAL} aria-label={name} className={AGENT_ITEM_CLASS}>
          <Logo />
          <span className="text-2xs text-warm-gray-light font-mono tracking-[0.15em] uppercase transition-colors duration-200 group-hover:text-brand-orange">
            {name}
          </span>
        </motion.a>
      ))}
    </motion.div>
  );
}
