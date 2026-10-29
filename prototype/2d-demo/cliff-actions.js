import {CLIFF_POINTS as P} from './cliff-route-layout.js';
const action=(label,command)=>({label,command});
const prop=(id,point,label,kind,eventId,actions,extra={})=>({id,...point,label,kind,eventId,actions,radius:37,...extra});
export const CLIFF_ROOMS=Object.freeze(['under_cliff','ice_cavern','craters_edge','crater']);
export function getCliffHotspots(state){
  switch(state.room){
    case 'under_cliff':return [
      prop('under_cliff:hive',P.hive,'蜂巢','cliff_hive','examine_beehive',[action('观察蜂巢','examine hive')],{
        radius:48,visualOptions:{drawAt:P.hiveArt},pointerShape:{kind:'ellipse',x:340,y:69,rx:19,ry:25,priority:1}}),
      prop('under_cliff:bees',P.bees,'蜂群','cliff_bees','examine_bees',[action('留意蜂群','examine bees')],{
        radius:42,pointerShape:{kind:'ellipse',x:368,y:96,rx:19,ry:14,priority:2}}),
      prop('under_cliff:ice-entry',P.cave,'岩洞','passage',undefined,[action('进入岩洞','in')],{
        radius:30,baked:true,pointerShape:{kind:'ellipse',x:237,y:86,rx:19,ry:22,priority:1}}),
    ];
    case 'ice_cavern':return [
      prop('ice_cavern:icicles',P.icicles,'冰锥','cliff_icicles','examine_icicles',[action('观察冰锥','examine icicles')],{
        radius:52,baked:true,pointerShape:{kind:'polygon',points:[[215,30],[315,30],[315,109],[215,109]],priority:1}}),
      prop('ice_cavern:exit',P.iceExit,'洞外的光','passage',undefined,[action('返回洞外','out')],{
        radius:30,baked:true,pointerShape:{kind:'ellipse',x:47,y:103,rx:22,ry:30,priority:1}}),
    ];
    case 'craters_edge':return [
      prop('craters_edge:rim',P.rim,'陨石坑','cliff_rim','examine_crater_edge',[action('观察坑沿','examine crater')],{
        radius:36,baked:true,pointerShape:{kind:'ellipse',x:297,y:189,rx:22,ry:12,priority:1}}),
      prop('craters_edge:descent',P.descent,'下行缓坡','passage',undefined,[action('沿缓坡下去','d')],{
        radius:31,baked:true,pointerShape:{kind:'ellipse',x:332,y:143,rx:14,ry:15,priority:1}}),
    ];
    case 'crater':return [
      prop('crater:ascent',P.ascent,'通往坑沿的缓坡','passage',undefined,[action('爬回坑沿','u')],{
        radius:30,baked:true,pointerShape:{kind:'ellipse',x:64,y:40,rx:17,ry:18,priority:1}}),
      ...(state.inRoom('lump')?[prop('crater:metal',P.metal,'金属块','cliff_metal','examine_lump',
        [action('碰触金属块','examine lump')],{itemId:'lump',pointerShape:{kind:'ellipse',x:P.metal.x,y:P.metal.y-5,rx:10,ry:6,priority:2}})]:[]),
    ];
    default:return [];
  }
}
