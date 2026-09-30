import {getLength, getPointAtLength} from '@remotion/paths';
import React from 'react';
import {interpolate, useCurrentFrame} from 'remotion';
import {Sfx} from '../lib/frame';
import {useTheme} from '../themes';
import {clamp, cuesOr, DonePill, linkPath, type Node, NODE_W, NodeCard, nodeLayout, type PrimitiveProps, Shot} from './atoms';

// A built automation runs (already on screen, so it follows flow-build without re-popping): each step lights on its cue, data tokens travel the links,
// the last step turns ok and stamps `done` a few times.
export const FlowRun: React.FC<PrimitiveProps<{nodes: Node[]; done: string}>> = ({p, dur, cues}) => {
  const th = useTheme();
  const f = useCurrentFrame();
  const n = p.nodes.length;
  const pos = nodeLayout(n);
  const at = cuesOr(cues, n, 10, dur - 20);
  const lastAt = at[n - 1];
  const links = pos.slice(0, -1).map((a, k) => linkPath(a, pos[k + 1]));
  const lens = links.map((d) => getLength(d));
  const on = (from: number) => interpolate(f, [from, from + 6], [0, 1], clamp);

  const tokens: React.ReactNode[] = [];
  for (let k = 0; ; k++) {
    const t0 = at[0] + 6 + k * 9;
    if (t0 > dur) break;
    const t = (f - t0) / (12 * links.length);
    if (t < 0 || t >= 1) continue;
    const seg = Math.floor(t * links.length);
    if (seg === links.length - 1 && t0 + 24 < lastAt) continue; // the last hop only runs once the result lands
    const pt = getPointAtLength(links[seg], lens[seg] * (t * links.length - seg));
    tokens.push(<circle key={k} cx={pt.x} cy={pt.y} r={11} fill={seg === links.length - 1 ? th.ok : th.flow} stroke={th.ink} strokeWidth={3} />);
  }
  const lastLit = on(lastAt);
  const bursts = [0, 12, 24].map((d) => lastAt + d).filter((b) => b < dur - 4);
  const L = pos[n - 1];
  return (
    <Shot dur={dur}>
      <svg style={{position: 'absolute', left: 0, top: 0, overflow: 'visible', zIndex: 1}} width={1} height={1}>
        {links.map((d, k) => (
          <path key={k} d={d} stroke={k === links.length - 1 && lastLit > 0.5 ? th.ok : th.flow} strokeWidth={5} fill="none" strokeLinecap="round" />
        ))}
        {tokens}
      </svg>
      {p.nodes.map((node, k) => (
        <NodeCard key={k} node={node} x={pos[k].x} y={pos[k].y} appear={1} active={k < n - 1 ? on(at[k]) : 0} green={k === n - 1 ? lastLit : 0} z={2} />
      ))}
      {bursts.map((b, k) => {
        const t = (f - b) / 22;
        if (t < 0 || t > 1) return null;
        return (
          <div key={k} style={{position: 'absolute', left: 0, top: 0, zIndex: 30}}>
            <div style={{position: 'absolute', left: L.x - NODE_W / 2 + 60 - 50 * (1 + t), top: L.y - 50 * (1 + t), width: 100 * (1 + t), height: 100 * (1 + t), borderRadius: '50%', border: `${6 * (1 - t)}px solid ${th.ok}`, opacity: 1 - t}} />
            <DonePill label={p.done} style={{position: 'absolute', left: L.x + NODE_W / 2 - 40 + 60 * t, top: L.y - 60 - 140 * t + k * 30, opacity: interpolate(t, [0, 0.15, 0.7, 1], [0, 1, 1, 0]), transform: `scale(${0.7 + 0.3 * Math.min(1, t * 4)})`}} />
          </div>
        );
      })}
      {at.slice(0, -1).map((a, k) => <Sfx key={k} at={a} name="pop" />)}
      <Sfx at={lastAt + 4} name="ding" />
    </Shot>
  );
};
