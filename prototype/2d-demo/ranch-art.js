import { paintCharacter } from './character.js';

const art = new Map();
function plate(name) {
  if (!art.has(name) && typeof Image !== 'undefined') {
    const image=new Image();
    image.src=new URL(`./assets/${name}-v1.png`,import.meta.url).href;
    art.set(name,image);
  }
  const image=art.get(name);
  return image?.complete && image.naturalWidth ? image : null;
}
export function warmWindmillArt(room) {
  if (room==='windmill' || room==='under_windmill') {
    for (const name of ['ranch-binoculars','ranch-windmill-landing-open','ranch-windmill-landing-planks']) plate(name);
  }
}
export function drawYardDoor(c,state){
  if(state.room!=='ne_yard')return;
  const open=plate('ranch-ne_yard-door-open');
  if(open&&state.hasFlag('ne_yard_outside_door_open'))c.drawImage(open,0,0,480,288);
}
export function drawRanchProp(c,object) {
  if (object.kind!=='binoculars') return false;
  const image=plate('ranch-binoculars');
  if (image) {
    const width=13, height=width*image.naturalHeight/image.naturalWidth;
    c.drawImage(image,object.x-width/2,object.y-height,width,height);
  }
  return true;
}
function ellipse(c,x,y,rx,ry,color) {
  c.strokeStyle=color;c.lineWidth=.6;c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.stroke();
}
export function drawSwimmer(c,room,player,time,moving=false) {
  const {x,y,face}=player, phase=time*(moving?5:2);
  c.save();
  if (room==='reservoir') {
    const waterline=y+Math.sin(phase)*.6;
    for(let i=0;i<2;i++){
      const age=(time*.7+i/2)%1;
      ellipse(c,x,waterline,7+age*10,1.7+age*3,`rgba(178,203,188,${.42*(1-age)})`);
    }
    c.beginPath();c.rect(x-18,y-20,36,waterline-y+20);c.clip();
    paintCharacter(c,x,waterline+22,'#937957',face,phase,false,{airborne:true,time});
  } else {
    const sign=face==='left'?-1:1;
    c.translate(x,y-4+Math.sin(phase)*.6);
    c.rotate(sign*(1.07+.045*Math.sin(phase)));c.globalAlpha=.76;
    paintCharacter(c,0,17,'#837b64',sign===1?'right':'left',phase,false,
      {airborne:true,time,moving,blend:moving?.45:0});
    c.rotate(-sign*1.07);
    for(let i=0;i<3;i++){
      const age=(time*.52+i/3)%1;
      ellipse(c,sign*13+Math.sin(age*6)*1.8,-5-age*13,.4+age,.6+age,`rgba(173,203,182,${.55*(1-age)})`);
    }
  }
  c.restore();
}
export function drawBottomVisibility(c,player,lit,bottomLight,lantern) {
  if(!lit){c.fillStyle='#040c0e';c.fillRect(0,0,480,288);return;}
  const at=bottomLight||player;
  const glow=c.createRadialGradient(at.x,at.y,10,at.x,at.y,136);
  glow.addColorStop(0,lantern?'#e2c98c55':'#ccbf6233');glow.addColorStop(.28,'#1d342d14');
  glow.addColorStop(.68,'#041a20a3');glow.addColorStop(1,'#030e13ec');
  c.fillStyle=glow;c.fillRect(0,0,480,288);
}

const clamp=t=>Math.max(0,Math.min(1,t));
function at(a,b,t){return a+(b-a)*clamp(t);}
export function windmillMotion(before,after,command) {
  if(before.chapter!=='ranch')return null;
  const from=before.room,to=after.room;
  const start=before.visual?.player, end=after.visual?.player;
  if(!start||!end)return null;
  let kind,duration;
  if(from==='windmill' && to==='reservoir'){kind='fall';duration=2.25;}
  else if((from==='under_windmill'&&to==='windmill')||(from==='windmill'&&to==='under_windmill')){kind='ladder';duration=.96;}
  else if(from==='south_reservoir' && to===from && command==='look at windmill through binoculars'
    && ['inventory','pocket','worn'].includes(after.itemLoc?.binoculars)){kind='focus';duration=2.25;}
  else return null;
  return {kind,duration,from,to,start,end,reaching:/^(?:take|get) /.test(command)};
}
export function windmillMotionRoom(m,t) {
  if(m.kind==='ladder')return t<.9 ? 'under_windmill' : m.to;
  return m.kind==='fall' && t<.7 ? 'windmill' : m.to;
}
export function drawWindmillMotion(c,m,t) {
  const {start,end}=m;
  c.save();
  if(m.kind==='focus'){
    const image=plate('ranch-reservoir-under_windmill-damaged');
    if(image){
      c.fillStyle='#0c1211';c.fillRect(0,0,480,288);
      c.beginPath();c.arc(185,140,91,0,2*Math.PI);c.moveTo(295+91,140);c.arc(295,140,91,0,2*Math.PI);c.clip();
      const zoom=1.8+clamp(t/.32)*.4;
      c.translate(240,143);c.scale(zoom,zoom);
      c.drawImage(image,-279,-89,480,288);
    }
  }else if(m.kind==='ladder'){
    if(t<.9){
      const up=m.to==='windmill',height=up?t/.9:1-t/.9;
      paintCharacter(c,at(269,278,height),at(165,79,height),'#a58a66','up',height*19,false,
        {airborne:true,moving:true,blend:1,time:t});
    }else paintCharacter(c,end.x,end.y,'#bca071',end.face,0,false,{});
  }else if(t<.7){
    const open=plate('ranch-windmill-landing-open'),planks=plate('ranch-windmill-landing-planks');
    const drop=clamp((t-.22)/.44), hingeAngle=Math.atan2(-19,130);
    if(open&&planks){
      c.drawImage(open,0,0,480,288);
      c.save();c.translate(159,83);c.rotate(hingeAngle);
      c.scale(1,Math.cos(drop*Math.PI*.47));c.rotate(-hingeAngle);c.translate(-159,-83);
      c.drawImage(planks,0,0,480,288);c.restore();
    }
    const reach=clamp(t/.23), fall=clamp((t-.31)/.36);
    const edge=m.reaching?Math.min(185,start.x):start.x;
    // The visible bank curves sharply left below the tower. Both trajectories
    // clear the concrete rim before cutting to the water-level splash.
    c.save();c.translate(at(at(start.x,edge,reach),42,fall),
      at(start.y,181,fall*fall)-7*Math.sin(fall*Math.PI));
    c.rotate(-fall*.96);
    paintCharacter(c,0,0,'#bca071','left',0,false,{airborne:true,action:m.reaching?'pickup':'idle',actionProgress:.5*reach});c.restore();
    const slip=clamp((t-.25)/.40);
    c.save();c.translate(at(174,34,slip),at(112,179,slip*slip));c.rotate(-slip*2.6);
    drawRanchProp(c,{kind:'binoculars',x:0,y:0});c.restore();
  }else{
    const splash=clamp((t-.7)/.3);
    if(splash>.38)drawSwimmer(c,'reservoir',end,splash);
    for(let i=0;i<3;i++)ellipse(c,end.x,end.y,4+splash*(16+i*6),1+splash*(3+i),
      `rgba(222,225,204,${(1-splash)*.8})`);
    for(let i=0;i<12;i++){
      const dx=(i-5.5)*3,up=(9+(i*7)%17)*4*splash*(1-splash);
      c.fillStyle=`rgba(206,222,210,${1-splash})`;c.fillRect(end.x+dx*splash,end.y-up,1,1.7);
    }
  }
  c.restore();
}
