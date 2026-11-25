import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const routeTool = fileURLToPath(new URL('./browser-cemetery-ferry.mjs',import.meta.url));
const stages = {
  river: { room:'the_river', environment:'PLAYED_FERRY_RIVER' },
  crater: { room:'shallow_crater', environment:'PLAYED_FERRY_CRATER' },
};

export async function playedFerryCheckpoint({ stage, url, output }) {
  const { room,environment } = stages[stage];
  const folder = join(output,'normal-ferry-route');
  const provided = process.env[environment];
  if (!provided) {
    await promisify(execFile)(process.execPath,[routeTool,`--${stage}-checkpoint`],{
      env:{...process.env,DEMO_URL:String(url),QA_OUTPUT:folder},
    });
  }
  const file = provided || join(folder,`${stage}-played.json`);
  const save = JSON.parse(await readFile(file,'utf8'));
  assert.equal(save.engine.state.room,room);
  assert.equal(save.engine.state.itemLoc.shroud,'worn');
  assert.equal(save.engine.state.itemLoc.silver_coin,stage==='river'?'inventory':'destroyed');
  return { file,save };
}
