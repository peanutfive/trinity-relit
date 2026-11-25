import assert from 'node:assert/strict';
import {vertexGnomonView} from '../islet-shadow.js';

// Start on the vertex with the portable prologue gnomon in hand. Traverse
// the arbor when its observed thread still differs from the dial's hole.
export async function installCarriedGnomon(engine) {
  const state=engine.state;
  assert.equal(state.room,'vertex');
  assert.equal(state.carrying('gnomon'),true);
  const mount=vertexGnomonView(state);
  if(mount.boltThread!==mount.holeThread) {
    for(const step of ['d','s','u','n','s','d','n','u']) await engine.processInput(step);
    assert.equal(state.room,'vertex');
  }
  await engine.processInput('put gnomon in hole');
  assert.equal(vertexGnomonView(state).installed,true);
}
