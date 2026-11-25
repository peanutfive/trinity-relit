import { ROOMS } from '../js/data/islet.js';
import { isletDoorView } from './islet-shadow.js';
import { ferryView, startFerry } from './ferry-state.js';
import { ferryEvents, ferryObservations } from './ferry-shore.js';
import { waitForFerry } from './ferry-voyage.js';
import { withSandbarGround, withIsletGround } from './sandbar-ground.js';

function islandEvents(room) {
  return room.events.map(event => {
    if (event.id.startsWith('give_coin_to_oarsman_'))
      return {...event,when:state => ferryView(state).legacyUnpaid && event.when(state)};
    if (event.id === 'enter_door_to_desert') {
      return {...event,async act(state,engine) {
        const door=isletDoorView(state);
        if (door.legacy) return event.act(state,engine);
        if (!door.open) return engine.print('The white door is closed.\n\n白门关着。');
        if (state.has('umbrella') && state.hasFlag('umbrella_open')) {
          return engine.print("You'll never fit through the door with that open umbrella.\n\n你撑着伞，挤不过这扇门。");
        }
        if (!await engine.activateChapter('desert')) return;
        engine.print('You take a deep breath, and step forward.\n\n你深吸一口气，向前迈步。');
        state.setFlag('islet_done');
        await engine.transitionChapter({to:'desert',roomCandidates:['shack']});
      }};
    }
    if (event.id === 'enter_door_to_desert_sb')
      return {...event,when:state => ferryView(state).fixedBerth && event.when(state)};
    return event;
  });
}

export const ISLET_ROOMS = {
  islet:withIsletGround({...ROOMS.islet, events:[...ferryObservations,...islandEvents(ROOMS.islet)]}),
  sand_bar:withSandbarGround({
    ...ROOMS.sand_bar,
    onEnter(state) { startFerry(state); },
    onWait:waitForFerry,
    exits(state) {
      const exits = ROOMS.sand_bar.exits(state);
      if (!ferryView(state).legacyPaid) delete exits.out;
      return exits;
    },
    events:[...islandEvents(ROOMS.sand_bar), ...ferryEvents],
  }),
};
