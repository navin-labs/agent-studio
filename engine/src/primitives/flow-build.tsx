import {evolvePath} from '@remotion/paths';
import React from 'react';
import {interpolate, useCurrentFrame} from 'remotion';
import {Sfx} from '../lib/frame';
import {alpha, useTheme} from '../themes';
import {clamp, cuesOr, lerp, linkPath, type Node, NODE_W, NodeCard, nodeLayout, type PrimitiveProps, prog, Shot, springFrom} from './atoms';

// Steps pop in on their cues, links draw between them, a cursor glides to each and clicks.
export const FlowBuild: React.FC<PrimitiveProps<{nodes: Node[]}>> = ({p, dur, cues}) => {
  const th = useTheme();
  const f = useCurrentFrame();
  const pos = nodeLayout(p.nodes.length);
  const at = cuesOr(cues, p.nodes.length, 6, Math.max(12, dur * 0.7));
  const links = pos.slice(0, -1).map((a, k) => linkPath(a, pos[k + 1]));
  // cursor: glides to each step just before it appears, clicks as it lands
  const pts = pos.map((n) => ({x: n.x + NODE_W / 2 - 60, y: n.y + 24}));
  let cx = pts[0].x + 160;
  let cy = pts[0].y - 120;
  at.forEach((a, k) => {
    const t = prog(f, a - 9, 9);
    cx = lerp(cx, pts[k].x, t);
    cy = lerp(cy, pts[k].y, t);
  });
  const last = [...at].reverse().find((a) => f >= a);
  const click = last === undefined ? 0 : interpolate(f - last, [0, 3, 10], [0, 1, 0], clamp);
  const ring = last === undefined ? 1 : (f - last) / 14;
  const cursorOn = prog(f, at[0] - 14, 6) * (1 - prog(f, at[at.length - 1] + 12, 10));
  return (
    <Shot dur={dur}>
      <svg style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}} width={1} height={1}>
        {links.map((d, k) => {
          const t = prog(f, at[k + 1] - 2, 10);
          if (t <= 0) return null;
          const ev = evolvePath(t, d);
          return <path key={k} d={d} stroke={th.flow} strokeWidth={5} fill="none" strokeLinecap="round" strokeDasharray={ev.strokeDasharray} strokeDashoffset={ev.strokeDashoffset} />;
        })}
      </svg>
      {p.nodes.map((n, k) => {
        const a = springFrom(f, at[k], {damping: 11, stiffness: 170});
        return a > 0.01 ? <NodeCard key={k} node={n} x={pos[k].x} y={pos[k].y} appear={a} active={0} green={0} /> : null;
      })}
      {cursorOn > 0 ? (
        <div style={{position: 'absolute', left: cx, top: cy, zIndex: 85, opacity: cursorOn}}>
          {ring < 1 ? <div style={{position: 'absolute', left: -40 * (0.4 + ring), top: -40 * (0.4 + ring), width: 80 * (0.4 + ring), height: 80 * (0.4 + ring), borderRadius: '50%', border: `4px solid ${th.flow}`, opacity: 1 - ring}} /> : null}
          <svg width={54} height={60} viewBox="0 0 24 26" style={{transform: `scale(${1 - 0.15 * click})`, transformOrigin: '0 0', filter: `drop-shadow(0 6px 10px ${alpha(th.shadow, 0.5)})`}}>
            <path d="M2 1 L2 20 L7 15.5 L10.5 23 L14 21.5 L10.5 14 L17 14 Z" fill={th.ink} stroke={th.surface} strokeWidth={1.4} strokeLinejoin="round" />
          </svg>
        </div>
      ) : null}
      {at.map((a, k) => <Sfx key={k} at={a} name="pop" />)}
    </Shot>
  );
};
