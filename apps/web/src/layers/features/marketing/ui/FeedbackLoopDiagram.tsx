'use client';

import { motion, useReducedMotion } from 'motion/react';
import { SCALE_IN, DRAW_PATH, VIEWPORT } from '../lib/motion-variants';

/**
 * SVG diagram of the Loop feedback cycle: 5 nodes arranged in a pentagon,
 * connected by animated paths with traveling particle dots.
 *
 * Respects `prefers-reduced-motion`: when reduced motion is requested,
 * path drawing and particle animations are disabled and paths render at full
 * opacity statically.
 */
export function FeedbackLoopDiagram() {
  const reducedMotion = useReducedMotion();

  return <DiagramSvg reducedMotion={reducedMotion ?? false} />;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Pentagon node positions (cx, cy) in a 400×400 viewBox, 5 nodes at 72° each. */
const RADIUS = 140;
const CX = 200;
const CY = 195;

/** Start at the top (–90°) and go clockwise. */
function pentagonPoint(index: number): { x: number; y: number } {
  const angle = (Math.PI * 2 * index) / 5 - Math.PI / 2;
  return {
    x: CX + RADIUS * Math.cos(angle),
    y: CY + RADIUS * Math.sin(angle),
  };
}

interface Node {
  label: string;
  sublabel: string;
  color: string;
  fill: string;
}

const NODES: Node[] = [
  {
    label: 'Signal',
    sublabel: 'errors · metrics · events',
    color: '#E85D04',
    fill: 'rgba(232,93,4,0.12)',
  },
  {
    label: 'Issue',
    sublabel: 'triage · prioritize',
    color: '#4A90A4',
    fill: 'rgba(74,144,164,0.12)',
  },
  {
    label: 'Prompt',
    sublabel: 'hydrate · template',
    color: '#8B7BA4',
    fill: 'rgba(139,123,164,0.12)',
  },
  { label: 'Dispatch', sublabel: 'score · send', color: '#228B22', fill: 'rgba(34,139,34,0.12)' },
  {
    label: 'Outcome',
    sublabel: 'review · feedback',
    color: '#7A756A',
    fill: 'rgba(122,117,106,0.12)',
  },
];

/** Build a cubic-bezier path string curving from point A to point B via the centre. */
function curvePath(from: { x: number; y: number }, to: { x: number; y: number }): string {
  // Pull control points 30% toward the centre so arrows arc nicely.
  const c1x = from.x + (CX - from.x) * 0.35;
  const c1y = from.y + (CY - from.y) * 0.35;
  const c2x = to.x + (CX - to.x) * 0.35;
  const c2y = to.y + (CY - to.y) * 0.35;
  return `M ${from.x} ${from.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${to.x} ${to.y}`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface DiagramSvgProps {
  reducedMotion: boolean;
}

function DiagramSvg({ reducedMotion }: DiagramSvgProps) {
  const points = NODES.map((_, i) => pentagonPoint(i));

  // Connection paths: each node connects to the next (wrapping).
  const paths = NODES.map((_, i) => {
    const from = points[i];
    const to = points[(i + 1) % NODES.length];
    return curvePath(from, to);
  });

  return (
    <motion.svg
      viewBox="0 0 400 390"
      width="400"
      height="390"
      aria-label="Loop feedback cycle: Signal feeds into Issue, then Prompt, then Dispatch, then Outcome, which feeds back into Signal"
      role="img"
      className="w-full max-w-[420px] select-none"
      initial="hidden"
      whileInView="visible"
      viewport={VIEWPORT}
    >
      <defs>
        {/* Arrowhead marker per node color */}
        {NODES.map((node, i) => (
          <marker
            key={i}
            id={`arrow-${i}`}
            markerWidth="8"
            markerHeight="8"
            refX="6"
            refY="3"
            orient="auto"
          >
            <path d="M0,0 L0,6 L8,3 z" fill={node.color} opacity="0.6" />
          </marker>
        ))}
      </defs>

      {/* Connection paths */}
      {paths.map((d, i) => (
        <ConnectionPath
          key={i}
          d={d}
          color={NODES[i].color}
          markerId={`arrow-${i}`}
          reducedMotion={reducedMotion}
          delay={i * 0.15}
        />
      ))}

      {/* Traveling particle dots */}
      {!reducedMotion &&
        paths.map((d, i) => (
          <ParticleDot
            key={i}
            d={d}
            color={NODES[i].color}
            duration={2.8 + i * 0.4}
            delay={i * 0.55}
          />
        ))}

      {/* Nodes */}
      {NODES.map((node, i) => (
        <DiagramNode key={i} node={node} cx={points[i].x} cy={points[i].y} delay={i * 0.1} />
      ))}
    </motion.svg>
  );
}

// ---------------------------------------------------------------------------

interface ConnectionPathProps {
  d: string;
  color: string;
  markerId: string;
  reducedMotion: boolean;
  delay: number;
}

function ConnectionPath({ d, color, markerId, reducedMotion, delay }: ConnectionPathProps) {
  if (reducedMotion) {
    return (
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeOpacity="0.35"
        markerEnd={`url(#${markerId})`}
      />
    );
  }

  return (
    <motion.path
      d={d}
      fill="none"
      stroke={color}
      strokeWidth="1.5"
      strokeOpacity="0.35"
      markerEnd={`url(#${markerId})`}
      variants={DRAW_PATH}
      transition={{ delay }}
    />
  );
}

// ---------------------------------------------------------------------------

interface ParticleDotProps {
  d: string;
  color: string;
  duration: number;
  delay: number;
}

/**
 * A small circle that travels along the given SVG path using SMIL animateMotion.
 * SMIL is used here (rather than Framer Motion) because animating along an
 * arbitrary bezier path is not supported by the Web Animations API that
 * motion/react uses under the hood.
 */
function ParticleDot({ d, color, duration, delay }: ParticleDotProps) {
  return (
    <circle r="3.5" fill={color} opacity="0.8" className="architecture-particles">
      <animateMotion dur={`${duration}s`} begin={`${delay}s`} repeatCount="indefinite" path={d} />
    </circle>
  );
}

// ---------------------------------------------------------------------------

interface DiagramNodeProps {
  node: Node;
  cx: number;
  cy: number;
  delay: number;
}

function DiagramNode({ node, cx, cy, delay }: DiagramNodeProps) {
  // Node circle radius
  const r = 38;

  return (
    <motion.g variants={SCALE_IN} transition={{ delay }}>
      {/* Glow fill */}
      <circle cx={cx} cy={cy} r={r} fill={node.fill} />
      {/* Stroke ring */}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={node.color}
        strokeWidth="1.5"
        strokeOpacity="0.6"
      />
      {/* Label */}
      <text
        x={cx}
        y={cy - 5}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={node.color}
        fontSize="11"
        fontWeight="600"
        fontFamily="var(--font-ibm-plex-mono), ui-monospace, monospace"
        letterSpacing="0.04em"
      >
        {node.label}
      </text>
      {/* Sublabel */}
      <text
        x={cx}
        y={cy + 10}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={node.color}
        fontSize="7.5"
        fontWeight="400"
        fontFamily="var(--font-ibm-plex-mono), ui-monospace, monospace"
        opacity="0.65"
        letterSpacing="0.02em"
      >
        {node.sublabel}
      </text>
    </motion.g>
  );
}
