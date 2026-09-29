import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {ensureFonts} from '../fonts';
import {StaticFrame} from '../lib/frame';
import {parseAccent} from '../lib/text';
import {HeroText} from '../reel/HeroText';
import {C, FONT, HANDLE, NAME, SLIDE} from '../theme';
import type {SlideProps, UIBlock} from '../types';
import {ChatCard} from '../ui/ChatCard';
import {FlowDiagram} from '../ui/FlowDiagram';
import {InboxCard} from '../ui/InboxCard';
import {NotifyStack} from '../ui/NotifyStack';
import {SheetCard} from '../ui/SheetCard';
import {uiHeight} from '../ui/sizes';
import {StepsList} from '../ui/StepsList';

ensureFonts();

const M = SLIDE.margin;
const CONTENT_TOP = 250;
const CONTENT_BOTTOM = SLIDE.h - 110;

const Bg: React.FC = () => (
  <AbsoluteFill style={{background: C.bg}}>
    <AbsoluteFill
      style={{
        backgroundImage: 'radial-gradient(rgba(255,255,255,0.045) 2px, transparent 2px)',
        backgroundSize: '44px 44px',
        WebkitMaskImage: 'radial-gradient(ellipse 90% 70% at 70% 20%, #000 20%, transparent 75%)',
        maskImage: 'radial-gradient(ellipse 90% 70% at 70% 20%, #000 20%, transparent 75%)',
      }}
    />
    <div
      style={{
        position: 'absolute',
        width: 1300,
        height: 1300,
        right: -520,
        top: -620,
        background: 'radial-gradient(circle, rgba(47,128,237,0.22) 0%, rgba(47,128,237,0.05) 40%, transparent 62%)',
      }}
    />
  </AbsoluteFill>
);

const Header: React.FC<{index: number; total: number}> = ({index, total}) => (
  <div style={{position: 'absolute', top: 84, left: M, right: M, display: 'flex', alignItems: 'center', gap: 22, fontFamily: FONT}}>
    <Img src={staticFile('brand/avatar.png')} style={{width: 88, height: 88, borderRadius: 44, border: '2px solid rgba(255,255,255,0.14)'}} />
    <div>
      <div style={{fontSize: 34, fontWeight: 800, color: C.text}}>{NAME}</div>
      <div style={{fontSize: 27, fontWeight: 500, color: C.faint, marginTop: 2}}>{HANDLE}</div>
    </div>
    <div style={{flex: 1}} />
    <div style={{fontSize: 28, fontWeight: 700, color: C.faint, fontVariantNumeric: 'tabular-nums'}}>
      {index + 1} / {total}
    </div>
  </div>
);

const UI: React.FC<{block: UIBlock}> = ({block: b}) => {
  switch (b.kind) {
    case 'inbox':
      return <InboxCard emails={b.emails} sorted={b.sorted} label={b.label} />;
    case 'sheet':
      return <SheetCard file={b.file} columns={b.columns} rows={b.rows} highlight={b.highlight} />;
    case 'chat':
      return <ChatCard contact={b.contact} status={b.status} messages={b.messages} />;
    case 'steps':
      return <StepsList steps={b.steps} strike={b.strike} />;
    case 'flow':
      return <FlowDiagram nodes={b.nodes} />;
    case 'notify':
      return <NotifyStack items={b.items} />;
    default:
      return null;
  }
};

const FitUI: React.FC<{block: UIBlock; top: number; bottom: number}> = ({block, top, bottom}) => {
  const box = bottom - top;
  const w = block.kind === 'flow' ? 820 : 888;
  const s = Math.min(1, box / uiHeight(block), (SLIDE.w - 2 * M) / w);
  return (
    <div style={{position: 'absolute', top, height: box, left: 0, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
      <div style={{transform: `scale(${s})`}}>
        <UI block={block} />
      </div>
    </div>
  );
};

const Body: React.FC<{text: string; size?: number}> = ({text, size = 38}) => (
  <div style={{fontSize: size, fontWeight: 500, color: '#B9C2CF', lineHeight: 1.42, marginTop: 26}}>{text}</div>
);

const Accented: React.FC<{text: string}> = ({text}) => (
  <>
    {parseAccent(text).map((w, i) => (
      <span key={i} style={{color: w.accent ? C.accent : undefined}}>
        {w.w}{' '}
      </span>
    ))}
  </>
);

export const SlideView: React.FC<SlideProps> = ({deck, index}) => {
  const slide = deck.slides[index];
  const total = deck.slides.length;
  let content: React.ReactNode = null;

  if (slide.type === 'cover') {
    content = (
      <div style={{position: 'absolute', top: CONTENT_TOP, bottom: 170, left: M, right: M, display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
        <HeroText text={slide.text} align="left" maxWidth={SLIDE.w - 2 * M} size={slide.text.length > 44 ? 88 : 104} />
        {slide.sub ? <Body text={slide.sub} size={40} /> : null}
      </div>
    );
  } else if (slide.type === 'point') {
    const hasUI = Boolean(slide.ui);
    content = (
      <>
        <div style={{position: 'absolute', top: CONTENT_TOP, left: M, right: M, ...(hasUI ? {} : {bottom: 170, display: 'flex', flexDirection: 'column', justifyContent: 'center'})}}>
          {slide.n != null ? (
            <div
              style={{
                display: 'inline-flex',
                alignSelf: 'flex-start',
                padding: '8px 20px',
                borderRadius: 16,
                background: C.accentSoft,
                color: '#6FA8F5',
                fontSize: 34,
                fontWeight: 900,
                marginBottom: 26,
              }}
            >
              {String(slide.n).padStart(2, '0')}
            </div>
          ) : null}
          <div style={{fontSize: hasUI ? 60 : 72, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.08, color: C.text}}>
            <Accented text={slide.title} />
          </div>
          {slide.body ? <Body text={slide.body} size={hasUI ? 34 : 40} /> : null}
        </div>
        {slide.ui ? <FitUI block={slide.ui} top={660} bottom={CONTENT_BOTTOM} /> : null}
      </>
    );
  } else if (slide.type === 'list') {
    content = (
      <div style={{position: 'absolute', top: CONTENT_TOP, bottom: 150, left: M, right: M, display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
        <div style={{fontSize: 68, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.08, color: C.text}}>
          <Accented text={slide.title} />
        </div>
        {slide.body ? <Body text={slide.body} /> : null}
        <div style={{marginTop: 48, display: 'flex', flexDirection: 'column', gap: 24}}>
          {slide.items.map((it, i) => (
            <div key={i} style={{display: 'flex', alignItems: 'flex-start', gap: 24}}>
              <svg width="52" height="52" viewBox="0 0 24 24" style={{flexShrink: 0, marginTop: 2}}>
                <circle cx="12" cy="12" r="11" fill={C.accentSoft} />
                <path d="M7 12.4l3.2 3.2L17.2 8.6" stroke={C.accent} strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span style={{fontSize: 42, fontWeight: 600, color: C.text, lineHeight: 1.3}}>{it}</span>
            </div>
          ))}
        </div>
      </div>
    );
  } else if (slide.type === 'statement') {
    content = (
      <div style={{position: 'absolute', top: CONTENT_TOP, bottom: 150, left: M, right: M, display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
        <div style={{width: 80, height: 10, borderRadius: 5, background: C.accent, marginBottom: 44}} />
        <HeroText text={slide.text} align="left" maxWidth={SLIDE.w - 2 * M} size={slide.text.length > 60 ? 76 : 90} />
        {slide.sub ? <Body text={slide.sub} size={40} /> : null}
      </div>
    );
  } else if (slide.type === 'cta') {
    const action = parseAccent(slide.action ?? 'DM *AUDIT*');
    content = (
      <div style={{position: 'absolute', top: CONTENT_TOP, bottom: 150, left: M, right: M, display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
        <HeroText text={slide.text} align="left" maxWidth={SLIDE.w - 2 * M} size={88} />
        {slide.sub ? <Body text={slide.sub} size={40} /> : null}
        <div style={{display: 'flex', alignItems: 'center', gap: 22, marginTop: 64}}>
          {action.map((w, i) =>
            w.accent ? (
              <div key={i} style={{background: C.accent, color: '#fff', borderRadius: 26, padding: '6px 30px 12px', fontSize: 96, fontWeight: 900, letterSpacing: '-0.03em', boxShadow: '0 20px 60px rgba(47,128,237,0.4)'}}>
                {w.w}
              </div>
            ) : (
              <span key={i} style={{fontSize: 96, fontWeight: 900, color: C.text, letterSpacing: '-0.03em'}}>
                {w.w}
              </span>
            ),
          )}
        </div>
      </div>
    );
  }

  const footer =
    slide.type === 'cover' ? (
      <div style={{position: 'absolute', bottom: 92, right: M, display: 'flex', alignItems: 'center', gap: 14, fontSize: 32, fontWeight: 800, color: C.accent}}>
        Swipe
        <svg width="40" height="40" viewBox="0 0 24 24">
          <path d="M5 12h13M13 6l6 6-6 6" stroke={C.accent} strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    ) : slide.type === 'cta' ? (
      <div style={{position: 'absolute', bottom: 92, left: M, display: 'flex', alignItems: 'center', gap: 16}}>
        <Img src={staticFile('brand/mark.png')} style={{width: 56, height: 56}} />
        <span style={{fontSize: 28, fontWeight: 700, color: C.faint}}>{HANDLE}</span>
      </div>
    ) : null;

  return (
    <StaticFrame.Provider value={9999}>
      <AbsoluteFill style={{fontFamily: FONT, color: C.text}}>
        <Bg />
        <Header index={index} total={total} />
        {content}
        {footer}
      </AbsoluteFill>
    </StaticFrame.Provider>
  );
};
