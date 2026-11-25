import { ROOMS } from '../js/data/islet.js';
import { ferryView, startFerry } from './ferry-state.js';
import { ferryEvents, ferryObservations } from './ferry-shore.js';
import { waitForFerry } from './ferry-voyage.js';
import { withSandbarGround, withIsletGround } from './sandbar-ground.js';

function islandEvents(room) {
  return room.events.map(event => {
    if (event.id.startsWith('give_coin_to_oarsman_'))
      return {...event,when:state => ferryView(state).legacyUnpaid && event.when(state)};
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
