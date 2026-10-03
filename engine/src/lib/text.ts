export type Word = {w: string; accent: boolean};

// "Still chasing *payments* by hand?" -> words with accent flags. Accents can span words: "*MIS report*".
export const parseAccent = (text: string): Word[] => {
  const out: Word[] = [];
  let inAccent = false;
  for (const raw of text.split(/\s+/).filter(Boolean)) {
    let w = raw;
    let opens = false;
    let closes = false;
    if (w.startsWith('*')) {
      opens = true;
      w = w.slice(1);
    }
    // closing star may sit before trailing punctuation: "*payments*?" or "*payments?*"
    const m = w.match(/^(.*?)\*([.,!?:;]*)$/);
    if (m) {
      closes = true;
      w = m[1] + m[2];
    }
    const accent = inAccent || opens;
    out.push({w, accent});
    if (opens) inAccent = true;
    if (closes) inAccent = false;
  }
  return out;
};

export const plain = (text: string) => text.replace(/\*/g, '');

export const splitWords = (text: string) => plain(text).split(/\s+/).filter(Boolean);

// Start frame of each spoken word, spread across the VO span by word length and punctuation pauses.
export const wordStarts = (text: string, lead: number, spanFrames: number): number[] => {
  const words = splitWords(text);
  if (words.length === 0) return [];
  const weights = words.map((w) => {
    let wt = Math.max(2, w.replace(/[^\p{L}\p{N}]/gu, '').length) + 1.5;
    if (/[,;:]$/.test(w)) wt += 3;
    if (/[.!?]$/.test(w)) wt += 5;
    return wt;
  });
  const total = weights.reduce((a, b) => a + b, 0);
  const starts: number[] = [];
  let acc = 0;
  for (const wt of weights) {
    starts.push(Math.round(lead + (acc / total) * spanFrames));
    acc += wt;
  }
  return starts;
};

export type Chunk = {words: string[]; startIdx: number};

// Group caption words into short lines (max 3 words / ~18 chars), breaking after punctuation.
export const chunkWords = (words: string[], maxWords = 3, maxChars = 18): Chunk[] => {
  const chunks: Chunk[] = [];
  let cur: string[] = [];
  let startIdx = 0;
  words.forEach((w, i) => {
    const len = cur.join(' ').length + (cur.length ? 1 : 0) + w.length;
    if (cur.length && (cur.length >= maxWords || len > maxChars)) {
      chunks.push({words: cur, startIdx});
      cur = [];
      startIdx = i;
    }
    cur.push(w);
    if (/[.,!?;:]$/.test(w)) {
      chunks.push({words: cur, startIdx});
      cur = [];
      startIdx = i + 1;
    }
  });
  if (cur.length) chunks.push({words: cur, startIdx});
  return chunks;
};
