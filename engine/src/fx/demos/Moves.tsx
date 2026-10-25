// The ten moves one after another, about 1.3 s each, in one style block (the kit's PROMPT 03, ported). One composition per
// block (moves-kinetic, moves-glass, moves-grain, moves-pop-bold): the same content, only the block changes.
import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame} from 'remotion';
import {ensureFonts} from '../../fonts';
import {FPS} from '../../lib/timing';
import {ThemeCtx} from '../../themes';
import {BlockProvider, type BlockId, blockTheme, BLOCKS, Card, Ground} from '../blocks';
import {BarFill, BlurIn, Checklist, CountUp, Pop, PunchIn, Reframe, Rise, SlideIn, Typewriter} from '../moves';

const STEP = 1.4;
export const MOVES_FRAMES = Math.round(STEP * 10 * FPS);
const NAMES = ['Rise', 'Pop', 'Count-up', 'Checklist tick', 'Typewriter', 'Slide-in', 'Blur-in', 'Punch-in', 'Reframe', 'Bar fill'];

const Body: React.FC<{t: number; i: number; block: BlockId}> = ({t, i}) => {
  const big: React.CSSProperties = {fontSize: 92, lineHeight: 1.05};
  const at = 0.15;
  const card = (txt: string) => <Card style={{...big, textAlign: 'center'}}>{txt}</Card>;
  switch (i) {
    case 0: return <Rise t={t} at={at}>{card('Invoices sent')}</Rise>;
    case 1: return <Pop t={t} at={at}>{card('Paid')}</Pop>;
    case 2: return <Card style={{textAlign: 'center'}}><CountUp t={t} at={at} to={48500} prefix="₹" style={{fontSize: 140}} /></Card>;
    case 3: return <Card><Checklist t={t} at={at} items={['Challan matched', 'Order checked', 'Invoice approved']} style={{fontSize: 58}} chime /></Card>;
    case 4: return <Card><Typewriter t={t} at={at} text="Reminder sent at 3 AM." style={{fontSize: 70}} /></Card>;
    case 5: return <SlideIn t={t} at={at}>{card('From the right')}</SlideIn>;
    case 6: return <BlurIn t={t} at={at}>{card('Into focus')}</BlurIn>;
    case 7: return <div style={{position: 'relative', width: 1080, height: 900}}><PunchIn t={t} at={at}><div style={{position: 'absolute', inset: 0, display: 'grid', placeItems: 'center'}}>{card('Look closer')}</div></PunchIn></div>;
    case 8: return null;
    default: return <Card style={{width: 820}}><BarFill t={t} at={at} label="Renewals done" style={{fontSize: 52}} chime /></Card>;
  }
};

export const MovesDemo: React.FC<{block: BlockId}> = ({block}) => {
  ensureFonts();
  const f = useCurrentFrame();
  const b = BLOCKS[block];
  return (
    <ThemeCtx.Provider value={blockTheme(block)}>
      <BlockProvider id={block}>
        <AbsoluteFill style={{fontFamily: b.display, textTransform: b.caps ? 'uppercase' : undefined}}>
          <Ground t={f / FPS} />
          {NAMES.map((name, i) => (
            <Sequence key={i} from={Math.round(i * STEP * FPS)} durationInFrames={Math.round(STEP * FPS)}>
              <Step i={i} name={name} block={block} />
            </Sequence>
          ))}
        </AbsoluteFill>
      </BlockProvider>
    </ThemeCtx.Provider>
  );
};

const Step: React.FC<{i: number; name: string; block: BlockId}> = ({i, name, block}) => {
  const t = useCurrentFrame() / FPS;
  const th = blockTheme(block);
  return (
    <AbsoluteFill>
      <div style={{position: 'absolute', top: 300, width: '100%', textAlign: 'center', fontFamily: 'Inter, sans-serif', fontSize: 34, letterSpacing: '0.2em', textTransform: 'uppercase', color: th.muted}}>{`${i + 1}. ${name}`}</div>
      {i === 8 ? (
        <Reframe t={t} at={0.2} panel={<div style={{width: '100%', height: '100%', background: th.surface}}><Ground t={t} /></div>} top={<Card style={{fontSize: 80}}>New card on top</Card>} />
      ) : (
        <div style={{position: 'absolute', left: 108, right: 108, top: 560, display: 'flex', justifyContent: 'center'}}>
          <Body t={t} i={i} block={block} />
        </div>
      )}
    </AbsoluteFill>
  );
};
