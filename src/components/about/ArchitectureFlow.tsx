import { useRef } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';

/**
 * The system architecture, drawn rather than diagrammed.
 *
 * Hand-authored SVG: the shape is fixed, so a drawn figure stays sharper and
 * more legible at phone width than a generic renderer, and the travelling
 * dashes let it show information moving through the system instead of merely
 * listing stages. The human-review node is the widest and darkest because it
 * is the decision point, and the safety override is drawn as the branch that
 * goes around the model entirely.
 */

interface Node {
  id: string;
  label: string;
  sub?: string;
  x: number;
  y: number;
  w: number;
  tone: 'plain' | 'channel' | 'strong' | 'decision' | 'alert';
}

const W = 220;

const NODES: Node[] = [
  { id: 'chat', label: 'Chat', x: 20, y: 16, w: 100, tone: 'channel' },
  { id: 'voice', label: 'Voice', x: 132, y: 16, w: 100, tone: 'channel' },
  { id: 'ivrs', label: 'IVRS', x: 244, y: 16, w: 100, tone: 'channel' },
  { id: 'sms', label: 'SMS', x: 356, y: 16, w: 100, tone: 'channel' },

  { id: 'normalized', label: 'Normalized interaction', x: 118, y: 96, w: 240, tone: 'strong' },
  {
    id: 'signals',
    label: 'Signal extraction',
    sub: 'language, voice, engagement',
    x: 118,
    y: 168,
    w: 240,
    tone: 'plain',
  },

  { id: 'baseline', label: 'Personal baseline', sub: 'within-person', x: 20, y: 248, w: W, tone: 'plain' },
  {
    id: 'trend',
    label: 'Longitudinal trend',
    sub: 'slope, persistence, change point',
    x: 260,
    y: 248,
    w: W,
    tone: 'plain',
  },
  {
    id: 'context',
    label: 'Case-stage context',
    sub: 'Stream A, statutory calendar',
    x: 500,
    y: 248,
    w: W,
    tone: 'plain',
  },

  {
    id: 'risk',
    label: 'Support priority + 14-day risk',
    sub: 'weighted fusion',
    x: 180,
    y: 336,
    w: 340,
    tone: 'strong',
  },
  {
    id: 'explain',
    label: 'Confidence and explainability',
    x: 180,
    y: 408,
    w: 340,
    tone: 'plain',
  },
  {
    id: 'human',
    label: 'Human review',
    sub: 'a named counsellor decides',
    x: 150,
    y: 480,
    w: 400,
    tone: 'decision',
  },
  { id: 'followup', label: 'Adaptive follow-up', x: 150, y: 560, w: 190, tone: 'plain' },
  { id: 'monitor', label: 'Continuous monitoring', x: 360, y: 560, w: 190, tone: 'plain' },

  {
    id: 'safety',
    label: 'Safety override',
    sub: 'deterministic, bypasses the model',
    x: 560,
    y: 168,
    w: 210,
    tone: 'alert',
  },
];

const FILLS: Record<Node['tone'], { fill: string; stroke: string; text: string; sub: string }> = {
  plain: { fill: '#FFFFFF', stroke: '#DCE4E0', text: '#17332B', sub: '#647A72' },
  channel: { fill: '#E2ECE7', stroke: '#CFE0D8', text: '#12372F', sub: '#3D564D' },
  strong: { fill: '#1F5A4B', stroke: '#1F5A4B', text: '#FFFFFF', sub: '#CFE0D8' },
  decision: { fill: '#0C1A16', stroke: '#0C1A16', text: '#FFFFFF', sub: '#9BBCB0' },
  alert: { fill: '#FFFFFF', stroke: '#9E4234', text: '#9E4234', sub: '#B4653F' },
};

interface Edge {
  from: string;
  to: string;
  alert?: boolean;
}

const EDGES: Edge[] = [
  { from: 'chat', to: 'normalized' },
  { from: 'voice', to: 'normalized' },
  { from: 'ivrs', to: 'normalized' },
  { from: 'sms', to: 'normalized' },
  { from: 'normalized', to: 'signals' },
  { from: 'signals', to: 'baseline' },
  { from: 'signals', to: 'trend' },
  { from: 'signals', to: 'context' },
  { from: 'baseline', to: 'risk' },
  { from: 'trend', to: 'risk' },
  { from: 'context', to: 'risk' },
  { from: 'risk', to: 'explain' },
  { from: 'explain', to: 'human' },
  { from: 'human', to: 'followup' },
  { from: 'followup', to: 'monitor' },
  { from: 'signals', to: 'safety', alert: true },
  { from: 'safety', to: 'human', alert: true },
];

const NODE_HEIGHT = 48;
const byId = (id: string): Node => NODES.find((node) => node.id === id) as Node;

const path = (edge: Edge): string => {
  const from = byId(edge.from);
  const to = byId(edge.to);
  const x1 = from.x + from.w / 2;
  const y1 = from.y + NODE_HEIGHT;
  const x2 = to.x + to.w / 2;
  const y2 = to.y;

  // A sideways branch leaves and rejoins horizontally; everything else flows down.
  if (Math.abs(y2 - y1) < 24) {
    return `M ${from.x + from.w} ${from.y + NODE_HEIGHT / 2} L ${to.x} ${to.y + NODE_HEIGHT / 2}`;
  }
  if (y2 < y1) {
    return `M ${from.x + from.w / 2} ${from.y} L ${x2} ${to.y + NODE_HEIGHT}`;
  }
  const midY = (y1 + y2) / 2;
  return `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;
};

export const ArchitectureFlow = () => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-12%' });
  const reduced = useReducedMotion();

  return (
    <figure ref={ref} className="overflow-x-auto">
      <svg
        viewBox="0 0 790 630"
        role="img"
        aria-labelledby="arch-title arch-desc"
        className="h-auto w-full min-w-[660px]"
      >
        <title id="arch-title">System architecture</title>
        <desc id="arch-desc">
          Chat, voice, phone keypad and text message all produce one normalized interaction event.
          Signals are extracted from it and feed a personal baseline, a longitudinal trend and the
          case-stage context, which combine into a support priority and a fourteen-day escalation
          risk. Confidence and explainability are attached, then a named counsellor reviews the case
          and decides, which sets an adaptive follow-up and returns to continuous monitoring. A
          deterministic safety override bypasses the model and routes straight to human review.
        </desc>

        <defs>
          <marker id="af-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5.5" markerHeight="5.5" orient="auto">
            <path d="M0,0 L10,5 L0,10 z" fill="#8FA29B" />
          </marker>
          <marker
            id="af-arrow-alert"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="5.5"
            markerHeight="5.5"
            orient="auto"
          >
            <path d="M0,0 L10,5 L0,10 z" fill="#9E4234" />
          </marker>
        </defs>

        <g>
          {EDGES.map((edge, index) => {
            const d = path(edge);
            return (
              <g key={`${edge.from}-${edge.to}`}>
                <motion.path
                  d={d}
                  fill="none"
                  stroke={edge.alert ? '#9E4234' : '#C7D3CD'}
                  strokeWidth={1.4}
                  strokeDasharray={edge.alert ? '5 4' : undefined}
                  markerEnd={edge.alert ? 'url(#af-arrow-alert)' : 'url(#af-arrow)'}
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={inView ? { pathLength: 1, opacity: 1 } : undefined}
                  transition={{ duration: 0.7, delay: 0.1 + index * 0.045, ease: [0.22, 1, 0.36, 1] }}
                />
                {/* Information travelling along the edge. */}
                {!reduced && !edge.alert ? (
                  <path
                    d={d}
                    fill="none"
                    stroke="#2E8474"
                    strokeWidth={1.6}
                    strokeDasharray="3 24"
                    className="animate-flow"
                    style={{ animationDelay: `${index * 0.12}s`, opacity: 0.55 }}
                  />
                ) : null}
              </g>
            );
          })}

          {NODES.map((node, index) => {
            const tone = FILLS[node.tone];
            return (
              <motion.g
                key={node.id}
                initial={{ opacity: 0, y: 8 }}
                animate={inView ? { opacity: 1, y: 0 } : undefined}
                transition={{ duration: 0.45, delay: index * 0.035, ease: [0.22, 1, 0.36, 1] }}
              >
                <rect
                  x={node.x}
                  y={node.y}
                  width={node.w}
                  height={NODE_HEIGHT}
                  rx={12}
                  fill={tone.fill}
                  stroke={tone.stroke}
                />
                <text
                  x={node.x + node.w / 2}
                  y={node.sub ? node.y + 21 : node.y + 29}
                  textAnchor="middle"
                  fontSize="12.5"
                  fontFamily="Inter, system-ui, sans-serif"
                  fill={tone.text}
                >
                  {node.label}
                </text>
                {node.sub ? (
                  <text
                    x={node.x + node.w / 2}
                    y={node.y + 36}
                    textAnchor="middle"
                    fontSize="10"
                    fontFamily="Inter, system-ui, sans-serif"
                    fill={tone.sub}
                  >
                    {node.sub}
                  </text>
                ) : null}
              </motion.g>
            );
          })}
        </g>
      </svg>
      <figcaption className="mt-4 max-w-[72ch] text-[12.5px] leading-relaxed text-ink-400">
        The AI does not replace the counsellor. It helps the counsellor know who needs attention,
        why, and when. The dashed branch is the deterministic safety override, which reaches a human
        without consulting the model at all.
      </figcaption>
    </figure>
  );
};
