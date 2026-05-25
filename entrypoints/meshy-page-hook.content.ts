import { defineContentScript } from '#imports';
import { installMeshyMainWorldHook } from '../src/lib/meshy-main-world-hook';

export default defineContentScript({
  matches: ['https://www.meshy.ai/*'],
  runAt: 'document_start',
  world: 'MAIN',
  main: installMeshyMainWorldHook,
});
