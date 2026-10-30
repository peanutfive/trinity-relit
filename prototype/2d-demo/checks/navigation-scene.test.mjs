import test from 'node:test';
import assert from 'node:assert/strict';
import {createNavigationSceneCache} from '../navigation-scene.js';
import {isBlocked,findPath,isSegmentWalkable} from '../world.js';
const floor=()=>({obstacles:[],footprint:{rx:6,ry:3},walkablePolygons:[[[20,20],[140,20],[140,100],[20,100]]],blockedPolygons:[],pathResolution:.25});
test('moving body rebuilds navigation without retaining its previous position or changing the artwork floor',()=>{
 const scene=floor(),before=structuredClone(scene),navigation=createNavigationSceneCache();
 const blocking=navigation(scene,[{x:70,y:20,w:20,h:80}]);
 assert.equal(isBlocked(blocking,80,60),true);assert.deepEqual(findPath(blocking,[40,60],[120,60]),[]);
 const clear=navigation(scene,[{x:70,y:120,w:20,h:10}]);
 assert.equal(isBlocked(clear,80,60),false);
 const path=findPath(clear,[40,60],[120,60]);assert.ok(path.length>=2);
 for(let i=1;i<path.length;i++)assert.ok(isSegmentWalkable(clear,path[i-1],path[i]));
 assert.deepEqual(scene,before);
});
test('static obstacle edits and replaced foot geometry update the shared navigation mesh',()=>{
 const scene=floor(),navigation=createNavigationSceneCache();
 assert.equal(isBlocked(navigation(scene),80,60),false);
 scene.obstacles.push({x:70,y:50,w:20,h:20});assert.equal(isBlocked(navigation(scene),80,60),true);
 scene.obstacles=[];assert.equal(isBlocked(navigation(scene),80,60),false);
 assert.equal(isBlocked(navigation(scene),28,60),false);
 scene.footprint={rx:12,ry:3};assert.equal(isBlocked(navigation(scene),28,60),true);
 scene.walkablePolygons=[[[40,20],[140,20],[140,100],[40,100]]];assert.equal(isBlocked(navigation(scene),35,60),true);
 scene.walkablePolygons=[[[20,20],[200,20],[200,100],[20,100]]];
 scene.obstacles=[{x:101.9,y:20,w:.05,h:80}];scene.footprint={rx:.001,ry:.001};
 scene.pathResolution=2;assert.equal(isSegmentWalkable(navigation(scene),[40,60],[180,60]),true);
 scene.pathResolution=.05;assert.equal(isSegmentWalkable(navigation(scene),[40,60],[180,60]),false);
});
