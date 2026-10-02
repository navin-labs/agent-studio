// Primitive specs: the contract for every motion primitive. Pure data, no React, so Node scripts
// (make.mjs, agent-studio QA) can read text limits and durations.
// A primitive is one full-frame shot. The Composer (A4) sequences shots and adds captions and transitions.
// Shots draw only inside STAGE (y 280 to 1080) so captions (y 1120+) and the IG header never collide.
import icons from '../ui/icon-names.json' with {type: 'json'};

export type Channel = 'c1-automation' | 'c2-reach' | 'c3-studio';
export type Family = 'kinetic-type' | 'camera' | 'transition' | 'world' | 'data' | 'texture';

export type Field =
  | {kind: 'text'; max: number; optional?: boolean} // max characters, *accent* markers not counted
  | {kind: 'icon'}
  | {kind: 'int'; min: number; max: number}
  | {kind: 'bool'}
  | {kind: 'enum'; of: string[]}
  | {kind: 'object'; fields: Record<string, Field>}
  | {kind: 'list'; min: number; max: number; of: Field};

export type Spec = {
  family: Family;
  about: string;
  channels: Channel[];
  seconds: [number, number]; // min, max shot length
  cues: string; // what the *accent* cue frames drive, in order
  params: Record<string, Field>;
  example: Record<string, unknown>; // the primitive's test storyboard
  captions?: false; // never show vo captions over this shot (it carries its own text)
  closer?: true; // may end a storyboard (a CTA card)
};

const text = (max: number, optional = false): Field => ({kind: 'text', max, optional});
const mode: Field = {kind: 'enum', of: ['manual', 'auto']};
const ALL: Channel[] = ['c1-automation', 'c2-reach', 'c3-studio'];
const item: Field = {kind: 'object', fields: {title: text(9), id: text(5), pill: text(6), amount: {kind: 'bool'}}};
const node: Field = {kind: 'object', fields: {icon: {kind: 'icon'}, label: text(16), sub: text(22)}};
const exItem = {title: 'ORDER', id: 'PO-', pill: 'NEW', amount: false};
const exNodes = [
  {icon: 'inbox', label: 'Read the email', sub: 'orders@ inbox'},
  {icon: 'search', label: 'Pull details', sub: 'Item, qty, address'},
  {icon: 'sheet', label: 'Add to sheet', sub: 'Orders.xlsx'},
  {icon: 'send', label: 'Confirm order', sub: 'Reply in 1 minute'},
];

export const SPECS: Record<string, Spec> = {
  'word-stack-slam': {
    family: 'kinetic-type',
    about: 'Headline words slam up one by one; *accent* words get the highlighter.',
    channels: ALL,
    seconds: [1.5, 4],
    cues: 'optional: frame the first highlighter lands (default: right after its word)',
    params: {text: text(40)},
    example: {text: 'Someone typed *all* of these.'},
  },
  'highlighter-swipe': {
    family: 'kinetic-type',
    about: 'A statement sits on screen; the highlighter swipes each *accent* word on its cue.',
    channels: ALL,
    seconds: [2, 5],
    cues: 'one per *accent* word, in order (default: spread evenly)',
    params: {text: text(60)},
    example: {text: "Here's the *fix*: let the sheet *update itself*."},
  },
  'pile-drop': {
    family: 'world',
    about: 'Paper cards rain onto a desk and pile up; the camera shakes when it gets buried.',
    channels: ALL,
    seconds: [2, 6],
    cues: 'optional: frame the pile is buried (shake)',
    params: {item, count: {kind: 'int', min: 4, max: 28}, start: {kind: 'int', min: 1, max: 99999}},
    example: {item: exItem, count: 22, start: 2201},
  },
  'counter-drop': {
    family: 'data',
    about: 'A status card whose number ticks from one value to another.',
    channels: ALL,
    seconds: [1.5, 4],
    cues: 'optional: frame the count starts',
    params: {label: text(10), icon: {kind: 'icon'}, from: {kind: 'int', min: 0, max: 999}, to: {kind: 'int', min: 0, max: 999}, tone: {kind: 'enum', of: ['alert', 'ok']}},
    example: {label: 'TO TYPE', icon: 'mail', from: 28, to: 0, tone: 'ok'},
  },
  'flow-build': {
    family: 'world',
    about: 'Automation steps pop in one by one, links draw between them, a cursor clicks each.',
    channels: ['c1-automation', 'c3-studio'],
    seconds: [2, 5],
    cues: 'one per step: the frame it appears',
    params: {nodes: {kind: 'list', min: 2, max: 4, of: node}},
    example: {nodes: exNodes},
  },
  'flow-run': {
    family: 'world',
    about: 'A built automation runs: each step lights on its cue, data travels the links, the last step stamps done.',
    channels: ['c1-automation', 'c3-studio'],
    seconds: [3, 8],
    cues: 'one per step: the frame it lights up',
    params: {nodes: {kind: 'list', min: 2, max: 4, of: node}, done: text(8)},
    example: {nodes: exNodes, done: 'DONE'},
  },
  conveyor: {
    family: 'world',
    about: 'Cards stream from a pile along a curve into one step, with motion blur.',
    channels: ALL,
    seconds: [2, 6],
    cues: 'optional: frame the stream starts',
    params: {item, node, count: {kind: 'int', min: 3, max: 20}},
    example: {item: exItem, node: exNodes[0], count: 12},
  },
  'chat-pop': {
    family: 'world',
    about: 'A chat bubble pops in with the app name, the message and read ticks.',
    channels: ALL,
    seconds: [1.5, 5],
    cues: 'optional: frame the bubble pops',
    params: {app: text(12), text: text(90)},
    example: {app: 'EMAIL', text: 'Hi Gupta ji, order PO-2214 is confirmed. Dispatch on 24 Sep.'},
  },
  'stamp-hit': {
    family: 'texture',
    about: 'Done badges stamp in with a ring burst, one per cue.',
    channels: ['c1-automation', 'c3-studio'],
    seconds: [1, 4],
    cues: 'one per stamp (default: spread evenly)',
    params: {label: text(8), count: {kind: 'int', min: 1, max: 6}},
    example: {label: 'PAID', count: 4},
  },
  'host-hook': {
    family: 'kinetic-type',
    about: 'Host format hook: the pain as huge type, accent word highlighted, the host reacting below.',
    channels: ['c1-automation'],
    seconds: [2, 5.5],
    cues: 'optional: frame the accent lands and the host reacts (default: right after its word)',
    params: {text: text(40)},
    example: {text: 'Still entering *supplier bills* by hand?'},
  },
  'ui-inbox': {
    family: 'world',
    about: 'Host format: an inbox. manual = cursor opens each email (amber); auto = each is read on its own (lime).',
    channels: ['c1-automation', 'c3-studio'],
    seconds: [3, 8],
    cues: 'one per email: the frame it is opened / read',
    params: {title: text(18), mode, rows: {kind: 'list', min: 3, max: 6, of: {kind: 'object', fields: {from: text(20), subject: text(34)}}}},
    example: {title: 'BILLS@ INBOX', mode: 'manual', rows: [
      {from: 'Mehta Traders', subject: 'Bill SB-4403, 4 cartons'},
      {from: 'Kapoor Foods', subject: 'Invoice INV-1042 attached'},
      {from: 'Shree Packaging', subject: 'Revised bill for 12 Sep'},
      {from: 'Gupta Steel', subject: 'Bill SB-4410, 4,20,000 rupees'},
    ]},
  },
  'ui-sheet': {
    family: 'world',
    about: 'Host format: a sheet filling up. manual = cursor types cell by cell (amber); auto = rows land whole (lime).',
    channels: ['c1-automation', 'c3-studio'],
    seconds: [3, 8],
    cues: 'one per row: the frame it starts filling',
    params: {file: text(20), mode, columns: {kind: 'list', min: 2, max: 4, of: text(10)}, rows: {kind: 'list', min: 2, max: 5, of: {kind: 'list', min: 2, max: 4, of: text(12)}}},
    example: {file: 'PURCHASE.XLSX', mode: 'manual', columns: ['BILL', 'PARTY', 'AMOUNT'], rows: [['SB-4403', 'Mehta', '38,500'], ['SB-4404', 'Kapoor', '1,12,000'], ['SB-4405', 'Shree', '9,800']]},
  },
  'ui-chat': {
    family: 'world',
    about: 'Host format: a chat thread. Messages pop in on cues. manual = cursor hits Send (amber); auto = yours tagged AUTO (lime).',
    channels: ['c1-automation', 'c3-studio'],
    seconds: [3, 8],
    cues: 'one per message: the frame it appears',
    params: {contact: text(18), mode, messages: {kind: 'list', min: 2, max: 4, of: {kind: 'object', fields: {from: {kind: 'enum', of: ['me', 'them']}, text: text(60)}}}},
    example: {contact: 'MEHTA TRADERS', mode: 'auto', messages: [
      {from: 'them', text: 'Did you get bill SB-4403?'},
      {from: 'me', text: 'Yes, entered today. Payment on 20 Sep.'},
      {from: 'them', text: 'Great, thank you!'},
    ]},
  },
  'ui-diff': {
    family: 'world',
    about: 'Host format: before vs after. Removed manual steps strike through in amber, added automatic steps glow lime.',
    channels: ['c1-automation', 'c3-studio'],
    seconds: [3, 8],
    cues: 'one per line: the frame it appears',
    params: {file: text(22), lines: {kind: 'list', min: 3, max: 8, of: {kind: 'object', fields: {op: {kind: 'enum', of: ['add', 'del', 'same']}, text: text(32)}}}},
    example: {file: 'BILL-ENTRY PROCESS', lines: [
      {op: 'del', text: 'Open every bill email'},
      {op: 'del', text: 'Type party, GSTIN, amount'},
      {op: 'del', text: 'Check totals by hand'},
      {op: 'add', text: 'Bill read on arrival'},
      {op: 'add', text: 'Entry added to register'},
      {op: 'same', text: 'You check the odd ones'},
    ]},
  },
  'host-payoff': {
    family: 'kinetic-type',
    about: 'Host format payoff: the takeaway as huge type, accent highlighted, the host hopping.',
    channels: ['c1-automation'],
    seconds: [2, 6],
    cues: 'optional: frame the accent lands and the host hops',
    params: {text: text(56)},
    example: {text: 'Bills enter *themselves.* You check the odd ones.'},
  },
  'host-cta': {
    family: 'kinetic-type',
    about: 'Host format closing card: CTA, offer line, brand line in the pixel font, host waving.',
    channels: ['c1-automation'],
    seconds: [2.5, 5],
    cues: 'none',
    captions: false,
    closer: true,
    params: {text: text(12), sub: text(60, true)}, // "DM " + keyword: wraps to 2 lines at most
    example: {text: 'DM *AUDIT*', sub: "I'll look at your most repetitive process for free."},
  },
  'split-flap': {
    family: 'data',
    about: 'Airport board: tiles flip through letters and land on a time, count or short word, left to right.',
    channels: ALL,
    seconds: [2.5, 5],
    cues: 'optional: the frame the last tile lands (default: 20 frames before the cut); the flipping starts early enough to land there',
    params: {label: text(24), text: text(10), sub: text(40, true)},
    example: {label: 'REPORT SENT AT', text: '9:30 AM', sub: 'Every morning, before anyone asks'},
  },
  'before-after-split': {
    family: 'world',
    about: 'Split screen: the manual way fills the top half, a divider sweeps and the automatic way fills the bottom.',
    channels: ALL,
    seconds: [3, 7],
    cues: 'two: the frame the before half lands, then the after half',
    params: {
      before: {kind: 'object', fields: {title: text(14), lines: {kind: 'list', min: 2, max: 3, of: text(26)}}},
      after: {kind: 'object', fields: {title: text(14), lines: {kind: 'list', min: 2, max: 3, of: text(26)}}},
    },
    example: {
      before: {title: 'BY HAND', lines: ['Open 40 order emails', 'Type each into the sheet', 'Reply one by one']},
      after: {title: 'AUTOMATIC', lines: ['Order read on arrival', 'Row added to the sheet', 'Buyer gets a reply']},
    },
  },
  'phone-buzz': {
    family: 'world',
    about: 'A phone lock screen fills with notifications, newest on top; the phone buzzes on each and the badge counts up.',
    channels: ALL,
    seconds: [2.5, 6],
    cues: 'one per notification: the frame it lands',
    params: {time: text(5), notes: {kind: 'list', min: 3, max: 5, of: {kind: 'object', fields: {icon: {kind: 'icon'}, from: text(18), text: text(26)}}}},
    example: {time: '9:41', notes: [
      {icon: 'whatsapp', from: 'Bansal Hardware', text: 'Order status? PO-2214'},
      {icon: 'mail', from: 'Iyer Electricals', text: 'Need the invoice copy'},
      {icon: 'whatsapp', from: 'Rao Paints', text: 'When will it dispatch?'},
      {icon: 'phone', from: 'Missed call (3)', text: 'Sethi Traders'},
    ]},
  },
  'maze-to-line': {
    family: 'world',
    about: 'A tangled path (the manual way) snaps into one straight line; a dot lost in the tangle zips to the end.',
    channels: ALL,
    seconds: [3, 6],
    cues: 'optional: the frame the tangle snaps straight (default 45%)',
    params: {from: text(14), to: text(14)},
    example: {from: 'ORDER IN', to: 'BUYER UPDATED'},
  },
  'zoom-dive': {
    family: 'camera',
    about: 'The camera dives through nested layers (inbox > email > attachment > the one number), landing on each in turn.',
    channels: ALL,
    seconds: [3, 7],
    cues: 'one per layer: the frame the camera lands on it (the first is the start)',
    params: {layers: {kind: 'list', min: 2, max: 4, of: {kind: 'object', fields: {icon: {kind: 'icon'}, label: text(18), sub: text(26, true)}}}},
    example: {layers: [
      {icon: 'inbox', label: 'bills@ inbox', sub: '38 unread this morning'},
      {icon: 'mail', label: 'Mehta Traders', sub: 'Bill SB-4403 attached'},
      {icon: 'file', label: 'SB-4403.pdf', sub: 'Page 1 of 1'},
      {icon: 'keyboard', label: 'Rs 38,500', sub: 'Typed by hand. Again.'},
    ]},
  },
  'end-card': {
    family: 'kinetic-type',
    about: 'Brand end card: logo, CTA with highlighted *accent*, promise line, authorship line.',
    channels: ALL,
    seconds: [2, 4],
    cues: 'none',
    captions: false,
    closer: true,
    params: {text: text(20), sub: text(60, true)},
    example: {text: '*Follow*', sub: 'One business automation, every day.'},
  },
};

// ---- validation: returns human-readable errors, empty when params fit the spec ----
const len = (s: string) => s.replace(/\*/g, '').length;

const check = (f: Field, v: unknown, at: string, errs: string[]): void => {
  if (v === undefined || v === null) {
    if (!(f.kind === 'text' && f.optional)) errs.push(`${at}: missing`);
    return;
  }
  switch (f.kind) {
    case 'text':
      if (typeof v !== 'string' || !v.trim()) errs.push(`${at}: must be non-empty text`);
      else if (len(v) > f.max) errs.push(`${at}: max ${f.max} characters, got ${len(v)}: "${v}"`);
      return;
    case 'icon':
      if (typeof v !== 'string' || !(v.toLowerCase() in icons)) errs.push(`${at}: unknown icon "${v}"`);
      return;
    case 'int':
      if (!Number.isInteger(v) || (v as number) < f.min || (v as number) > f.max) errs.push(`${at}: must be a whole number ${f.min} to ${f.max}`);
      return;
    case 'bool':
      if (typeof v !== 'boolean') errs.push(`${at}: must be true or false`);
      return;
    case 'enum':
      if (!f.of.includes(v as string)) errs.push(`${at}: must be one of ${f.of.join(', ')}`);
      return;
    case 'object':
      if (typeof v !== 'object' || Array.isArray(v)) return void errs.push(`${at}: must be an object`);
      for (const [k, sub] of Object.entries(f.fields)) check(sub, (v as Record<string, unknown>)[k], `${at}.${k}`, errs);
      for (const k of Object.keys(v)) if (!(k in f.fields)) errs.push(`${at}.${k}: unknown field`);
      return;
    case 'list':
      if (!Array.isArray(v)) return void errs.push(`${at}: must be a list`);
      if (v.length < f.min || v.length > f.max) errs.push(`${at}: needs ${f.min} to ${f.max} items, got ${v.length}`);
      v.forEach((x, i) => check(f.of, x, `${at}[${i}]`, errs));
  }
};

export const validateParams = (id: string, params: unknown): string[] => {
  const spec = SPECS[id];
  if (!spec) return [`unknown primitive "${id}" (use one of: ${Object.keys(SPECS).join(', ')})`];
  const errs: string[] = [];
  check({kind: 'object', fields: spec.params}, params, id, errs);
  return errs;
};
