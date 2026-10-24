// Presentation seconds only: these cues never advance the original game state.
const clamp=x=>Math.max(0,Math.min(1,x));
const ease=x=>{const t=clamp(x);return t*t*(3-2*t);};
const mix=(a,b,t)=>a+(b-a)*t;
export const UMBRELLA_DURATION=13.2;
export const UMBRELLA_CUES=Object.freeze([
  ['prepare',0,.9],['raise',.9,1.9],['open',1.9,3.1],['hold',3.1,4.0],
  ['brace',4.0,4.9],['released',4.9,7.1],['settle',7.1,7.8],
  ['circle',7.8,9.5],['look_up',9.5,10.2],['wipe',10.2,11.0],['kick',11.0,11.6],['leave',11.6,13.2],
]);
// Coordinates relative to calibrated human ground anchor; match visible fingers.
export const BODY_POSES=Object.freeze([
  {source:[197,1,190,373],foot:[291,367],head:16,grip:[-1,-18]},
  {source:[516,1,215,373],foot:[620,367],head:17,grip:[2,-24]},
  {source:[844,0,214,374],foot:[969,367],head:49,grip:[-7,-35]},
  {source:[1172,0,226,374],foot:[1285,367],head:48,grip:[-7,-35]},
  {source:[134,375,279,326],foot:[278,693],head:384,grip:[-7,-21]},
  {source:[490,375,346,327],foot:[604,694],head:390,grip:[21,-27]},
  {source:[870,373,194,333],foot:[975,698],head:382,grip:[0,-17]},
  {source:[1219,374,190,334],foot:[1322,699],head:382,grip:[0,-17]},
  {source:[70,700,346,324],foot:[226,1015],head:705,grip:[0,-17]},
]);
const frameByAction={prepare:0,raise:1,open:2,hold:3,brace:4,released:5,settle:6,circle:6,look_up:6,wipe:7,kick:8,leave:6};
export function bodyFrameFor(action){return frameByAction[action]??0;}
export function openingVisual(action,progress=0){
  const p=ease(progress),frame=bodyFrameFor(action);
  const openness=action==='open'?mix(.15,1,p):action==='hold'||action==='brace'?1:0;
  const tilt=action==='prepare'?.05:action==='raise'?mix(.05,-Math.PI,p):action==='open'?(openness<.16?-Math.PI:0):action==='brace'?mix(0,.32,p):0;
  return {bodyFrame:frame,action,progress,openness,tilt,grip:[...BODY_POSES[frame].grip]};
}
export function idleUmbrellaVisual(seconds){
  // A failed opening attempt: she lifts the shaft, works the runner and lowers
  // it again against the wind. This is a visual loop, never an extra turn.
  const t=((seconds%5.6)+5.6)%5.6;
  if(t<1.1)return openingVisual('prepare',t/1.1);
  if(t<2.1)return openingVisual('raise',(t-1.1));
  if(t<3.3){const v=openingVisual('open',(t-2.1)/1.2);return {...v,openness:v.openness*.62};}
  if(t<4.5){const p=(t-3.3)/1.2,v=openingVisual('open',1-p);return {...v,openness:v.openness*.62};}
  return openingVisual('raise',1-(t-4.5)/1.1);
}
export function umbrellaScene(seconds,anchors){
  const time=Math.max(0,Math.min(UMBRELLA_DURATION,seconds));
  const [action,start,end]=UMBRELLA_CUES.find(([,a,b])=>time>=a&&time<b)||UMBRELLA_CUES.at(-1);
  const progress=clamp((time-start)/(end-start)),v=openingVisual(action,progress);
  const origin=anchors.umbrellaWoman,target=anchors.umbrella;
  let x=origin.x,y=origin.y;
  const treeSide={x:anchors.tree.x-20,y:anchors.tree.y+34};
  if(time>=7.8){const p=ease((time-7.8)/1.7);x=mix(x,treeSide.x,p);y=mix(y,treeSide.y,p)+Math.sin(p*Math.PI*2)*3;}
  if(action==='leave'){const p=ease(progress);x=mix(treeSide.x,235,p);y=mix(treeSide.y,320,p);}
  // The gust drags her hands back to her chest before the grip breaks.
  const releaseGrip=BODY_POSES[4].grip;
  const releasePoint={x:origin.x+releaseGrip[0],y:origin.y+releaseGrip[1]};
  let umbrella={x:x+v.grip[0],y:y+v.grip[1],openness:v.openness,rotation:v.tilt,attached:true};
  if(time>=4.9){
    const p=clamp((time-4.9)/2.2),q=ease(p),arc=Math.sin(p*Math.PI);
    umbrella={x:mix(releasePoint.x,target.x,q)+arc*9,
      y:mix(releasePoint.y,target.y,q)-arc*43,
      openness:1,rotation:.32*(1-q)+Math.sin(p*Math.PI*2)*.6,
      attached:false,flight:p};
    if(time>=7.1){const settle=clamp((time-7.1)/.7);umbrella.rotation=Math.sin(settle*Math.PI*3)*.14*(1-settle);}
  }
  return {action,progress,body:{x,y,...v,standing:true,walking:action==='circle'||action==='leave'},umbrella};
}
