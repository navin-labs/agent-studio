// Reads an mp4's container facts for QA (size, fps, length, audio). Uses @remotion/media-parser, already installed with Remotion; no ffprobe needed.
import {parseMedia} from '@remotion/media-parser';
import {nodeReader} from '@remotion/media-parser/node';
import fs from 'node:fs';

export type Probe = {container: string; width: number; height: number; fps: number; seconds: number; audio: boolean; complete?: boolean};

// The header of an mp4 can describe a whole film while the file stops half-way (a render killed or a disk filled). Walk the top-level
// boxes: they must tile the file exactly (nothing missing at the end, no stray bytes after the last box) and include moov and mdat.
export const mp4Complete = (file: string): boolean => {
  const fd = fs.openSync(file, 'r');
  try {
    const size = fs.fstatSync(fd).size;
    const h = Buffer.alloc(16);
    let pos = 0;
    const types = new Set<string>();
    while (pos < size) {
      if (size - pos < 8) return false;
      fs.readSync(fd, h, 0, 16, pos);
      let len = h.readUInt32BE(0);
      if (len === 1) len = size - pos < 16 ? 0 : Number(h.readBigUInt64BE(8));
      else if (len === 0) len = size - pos; // a last box that runs to the end of the file
      if (len < 8 || pos + len > size) return false;
      types.add(h.toString('latin1', 4, 8));
      pos += len;
    }
    return types.has('moov') && types.has('mdat'); // tiled, and it holds both the index and the media
  } finally {
    fs.closeSync(fd);
  }
};

export const probeVideo = async (file: string): Promise<Probe> => {
  const complete = mp4Complete(file);
  const r = await parseMedia({src: file, reader: nodeReader, fields: {container: true, dimensions: true, fps: true, durationInSeconds: true, tracks: true}, logLevel: 'error'});
  return {container: r.container, width: r.dimensions?.width ?? 0, height: r.dimensions?.height ?? 0, fps: r.fps ?? 0, seconds: r.durationInSeconds ?? 0, audio: r.tracks.some((t) => t.type === 'audio'), complete};
};

// A file the parser cannot read is a failed check, not a crashed QA run.
export const probeOrBroken = (file: string): Promise<Probe> => probeVideo(file).catch(() => ({container: 'unreadable', width: 0, height: 0, fps: 0, seconds: 0, audio: false, complete: false}));
