// Test helper: the recipe CLI with the drawn-shot pool restored (see drawn-beats.ts).
import './drawn-beats.ts';
import {cli} from './recipe.ts';

cli(process.argv.slice(2));
