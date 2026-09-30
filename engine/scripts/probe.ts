// Reads an mp4's container facts for QA (size, fps, length, audio). Uses @remotion/media-parser, already installed with Remotion; no ffprobe needed.
import {parseMedia} from '@remotion/media-parser';
import {nodeReader} from '@remotion/media-parser/node';

export type Probe = {container: string; width: number; height: number; fps: number; seconds: number; audio: boolean};

export const probeVideo = async (file: string): Promise<Probe> => {
  const r = await parseMedia({src: file, reader: nodeReader, fields: {container: true, dimensions: true, fps: true, durationInSeconds: true, tracks: true}, logLevel: 'error'});
  return {container: r.container, width: r.dimensions?.width ?? 0, height: r.dimensions?.height ?? 0, fps: r.fps ?? 0, seconds: r.durationInSeconds ?? 0, audio: r.tracks.some((t) => t.type === 'audio')};
};
