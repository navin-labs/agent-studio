// Brand system for theautomationguy.navin. Change colors here, nowhere else.
export const C = {
  bg: '#111418',
  bgDeep: '#0B0D10',
  text: '#F2F4F7',
  muted: '#A3ADBB',
  faint: '#6B7584',
  accent: '#2F80ED',
  accentSoft: 'rgba(47,128,237,0.18)',
  panel: '#171C23',
  panelLine: '#262D38',
  // light "app UI" cards
  card: '#F7F8FA',
  cardText: '#12161C',
  cardMuted: '#6B7280',
  cardLine: '#E4E7EC',
  cardHead: '#EEF1F5',
  red: '#E5484D',
  redSoft: '#FDECEC',
  green: '#2DA44E',
  greenSoft: '#E6F6EA',
  amber: '#F5A524',
  amberSoft: '#FEF4E2',
  blueSoft: '#E8F1FD',
};

export const FONT = "'Inter', system-ui, -apple-system, sans-serif";

export const HANDLE = '@theautomationguy.navin';
export const NAME = 'Navin Rana';

// Reel canvas and Instagram safe zones (px)
export const REEL = {
  w: 1080,
  h: 1920,
  fps: 30,
  side: 96, // content margin left/right
  safeTop: 250, // Instagram header covers this
  safeBottom: 420, // caption, username, audio row cover this
};

// Fixed layout zones for UI scenes
export const ZONES = {
  progressY: 266,
  kickerY: 322,
  heroTop: 560,
  heroHeight: 700,
  captionTop: 1296,
  captionHeight: 190,
};

export const SLIDE = {w: 1080, h: 1350, margin: 96};

export const AVATAR_COLORS = ['#2F80ED', '#E5484D', '#2DA44E', '#F5A524', '#8B5CF6', '#0EA5E9'];

// ---------- Faceless Brand Tokens v1: "Paper & Signal" (locked 2026-09-29, Notion Playbook) ----------
// Max 3 colours per frame: paper, ink, plus ONE of signal / flow / status.
export const P = {
  paper: '#F4F1EA', // background
  surface: '#FFFFFF', // cards, UI screens
  ink: '#111111', // headlines, outlines, lines
  inkSoft: '#5C5A55', // secondary text, labels
  rule: '#E3DED3', // grid, dividers
  signal: '#C6F432', // highlighter behind keywords ONLY, never text
  flow: '#2B4BFF', // automation lines, nodes, travelling data
  ok: '#1F9D55', // large text, icons, pills only
  alert: '#E5484D', // large text, icons, pills only
  night: '#111111', // CTA end card
};
export const TYPE = {
  display: "'Inter Tight', 'Inter', sans-serif", // 900, -4% tracking, 128-160px
  title: "'Inter Tight', 'Inter', sans-serif", // 800, 64-80px
  caption: "'Inter', sans-serif", // 800, 58px
  data: "'JetBrains Mono', 'Inter', monospace", // 600, 26-34px
};
export const CARD = {background: '#FFFFFF', border: '3px solid #111111', borderRadius: 20, boxShadow: '8px 8px 0 #111111'};
