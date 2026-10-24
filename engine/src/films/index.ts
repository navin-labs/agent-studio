// Authored films, one file per story (agents/director/DIRECTOR.md). A board renders as a film when its "film" names one here.
import type React from 'react';
import {SceneFilm} from './SceneFilm';
import {Film as F_c1_2026_w41_1} from './c1-2026-w41-1';
import {Film as F_c2_2026_w40_1} from './c2-2026-w40-1';
import {Film as F_c2_2026_w41_1} from './c2-2026-w41-1';
import {Film as F_c1_2026_w41_3} from './c1-2026-w41-3';
import {Film as F_c2_2026_w41_2} from './c2-2026-w41-2';

export const FILMS: Record<string, React.FC> = {scene: SceneFilm, 'c2-2026-w40-1': F_c2_2026_w40_1, 'c1-2026-w41-1': F_c1_2026_w41_1, 'c2-2026-w41-1': F_c2_2026_w41_1, 'c1-2026-w41-3': F_c1_2026_w41_3, 'c2-2026-w41-2': F_c2_2026_w41_2};
