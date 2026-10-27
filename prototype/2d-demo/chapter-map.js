import { MAP_SIZE, illustratedMapNodes, chartConnection, chartRoadPath } from './map-geography.js';
import { terrainMarkup, mapIconPath } from './chapter-map-art.js';
import { ROOMS as PROLOGUE_ROOMS } from '../js/data/prologue.js';
import { ROOMS as WABE_ROOMS } from '../js/data/wabe.js';
import { ROOMS as JAPAN_ROOMS } from '../js/data/japan.js';

const DEFAULT_CHAPTER_ROOMS={prologue:PROLOGUE_ROOMS,wabe:WABE_ROOMS,japan:JAPAN_ROOMS};
const CHAPTER_LABELS={prologue:'序章',wabe:'异境',japan:'日本游乐场'};
const DIRECTIONS={n:'北',ne:'东北',e:'东',se:'东南',s:'南',sw:'西南',w:'西',nw:'西北',u:'上',d:'下',in:'进入',out:'出去'};
const DIRECTION_ORDER=Object.keys(DIRECTIONS);
const list=value=>value instanceof Set?[...value]:Array.isArray(value)?[...value]:[];
const own=(object,key)=>Object.hasOwn(object||{},key);
const compare=(a,b)=>String(a).localeCompare(String(b),'en');

function copy(value){
  if(value===null||typeof value!=='object')return typeof value==='function'?undefined:value;
  if(value instanceof Set)return new Set([...value].map(copy));
  if(Array.isArray(value))return Object.freeze(value.map(copy));
  return Object.freeze(Object.fromEntries(Object.entries(value).filter(([,entry])=>typeof entry!=='function').map(([key,entry])=>[key,copy(entry)])));
}
function readSet(values){
  const entries=new Set(values);
  return new Proxy(entries,{get(target,key){
    if(['add','delete','clear'].includes(key))return ()=>{throw new TypeError('地图只读。');};
    const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;
  }});
}
function roomView(raw,room){
  const view={...copy(raw),room,flags:readSet(list(raw.flags)),visited:readSet(list(raw.visited))};
  const at=id=>view.itemLoc?.[id];
  Object.assign(view,{
    has:id=>['inventory','pocket','worn'].includes(at(id)),carrying:id=>at(id)==='inventory',
    inPocket:id=>at(id)==='pocket',wearing:id=>at(id)==='worn',inRoom:id=>at(id)===room,itemAt:at,
    hasFlag:flag=>view.flags.has(flag),cnt:id=>view.counters?.[id]||0,
    roomItems:()=>Object.keys(view.itemLoc||{}).filter(id=>at(id)===room),
    inventoryList:()=>Object.keys(view.itemLoc||{}).filter(id=>['inventory','pocket','worn'].includes(at(id))).map(id=>({id,loc:at(id)})),
    carryCount:()=>Object.values(view.itemLoc||{}).filter(loc=>loc==='inventory').length,
  });
  return Object.freeze(view);
}

/** Deterministic topology layout. Directions label edges; they never invent geography. */
export function layoutChapterMap(nodes,edges,{width=960,height=570}={}){
  const positions=nodes.map((node,index)=>{
    const angle=index*2.399963229728653,radius=nodes.length===1?0:Math.min(width,height)*(.14+.23*Math.sqrt((index+1)/nodes.length));
    return {...node,x:width/2+Math.cos(angle)*radius,y:height/2+Math.sin(angle)*radius};
  });
  const byId=new Map(positions.map((node,index)=>[node.id,index])),links=[],seen=new Set();
  for(const edge of edges){
    const pair=[edge.from,edge.to].sort(compare).join('|');
    if(edge.from!==edge.to&&!seen.has(pair)){seen.add(pair);links.push([byId.get(edge.from),byId.get(edge.to)]);}
  }
  for(let iteration=0;iteration<260;iteration++){
    const forces=positions.map(node=>({x:(width/2-node.x)*.012,y:(height/2-node.y)*.018}));
    for(let i=0;i<positions.length;i++)for(let j=i+1;j<positions.length;j++){
      const dx=positions[j].x-positions[i].x||.01,dy=positions[j].y-positions[i].y||.01;
      const distance=Math.max(1,Math.hypot(dx,dy)),force=15000/(distance*distance);
      const overlap=Math.max(0,1-Math.hypot(dx/178,dy/78))*16;
      const fx=dx/distance*(force+overlap),fy=dy/distance*(force+overlap);
      forces[i].x-=fx;forces[i].y-=fy;forces[j].x+=fx;forces[j].y+=fy;
    }
    for(const [i,j] of links){
      const dx=positions[j].x-positions[i].x,dy=positions[j].y-positions[i].y,distance=Math.max(1,Math.hypot(dx,dy));
      const force=(distance-180)*.028,fx=dx/distance*force,fy=dy/distance*force;
      forces[i].x+=fx;forces[i].y+=fy;forces[j].x-=fx;forces[j].y-=fy;
    }
    const step=.9*(1-iteration/330);
    positions.forEach((node,index)=>{
      node.x=Math.max(91,Math.min(width-91,node.x+forces[index].x*step));
      node.y=Math.max(40,Math.min(height-40,node.y+forces[index].y*step));
    });
  }
  if(positions.length>=5){
    const xs=positions.map(node=>node.x),ys=positions.map(node=>node.y);
    const minX=Math.min(...xs),minY=Math.min(...ys),spanX=Math.max(...xs)-minX,spanY=Math.max(...ys)-minY;
    positions.forEach(node=>{
      node.x=91+(node.x-minX)/Math.max(1,spanX)*(width-182);
      node.y=45+(node.y-minY)/Math.max(1,spanY)*(height-90);
    });
  }
  return positions.map(node=>({...node,x:Math.round(node.x*100)/100,y:Math.round(node.y*100)/100}));
}

/**
 * Reads the existing room exit functions through independent, immutable state
 * views. No descriptions, events, exit acts, onEnter hooks or commands execute.
 * Unknown visual rooms disclose neither names nor descriptions.
 */
export function buildChapterMap({state={},rooms,scenes={},chapter,chapterRooms=DEFAULT_CHAPTER_ROOMS,roomChapters={},chapterLabels={}}={}){
  const raw=typeof state.serialize==='function'?state.serialize():state;
  const definitions=rooms||Object.assign({},...Object.values(chapterRooms));
  const owners={};
  for(const [id,entries] of Object.entries(chapterRooms))for(const room of Object.keys(entries||{}))owners[room]=id;
  for(const [id,room] of Object.entries(definitions))if(typeof room.chapter==='string')owners[id]=room.chapter;
  for(const [id,scene] of Object.entries(scenes))if(typeof scene.chapter==='string')owners[id]=scene.chapter;
  Object.assign(owners,roomChapters);
  if(raw.room&&!owners[raw.room])owners[raw.room]=raw.chapter||'prologue';
  const discovered=new Set([...list(raw.visited),raw.room].filter(id=>typeof id==='string'&&id&&(own(definitions,id)||id===raw.room)));
  const available=[...new Set([...discovered].map(id=>owners[id]).filter(Boolean))].sort(compare);
  const labels={...CHAPTER_LABELS,...chapterLabels};
  const chapters=available.map(id=>({id,label:labels[id]||'已探索章节',current:id===raw.chapter}));
  const selected=available.includes(chapter)?chapter:available.includes(raw.chapter)?raw.chapter:available[0]||null;
  const ids=[...discovered].filter(id=>owners[id]===selected).sort(compare),known=new Set(ids),edges=[],warnings=[];
  const nodes=ids.map(id=>{
    const room=definitions[id],visual=own(scenes,id);
    return {id,chapter:selected,cn:visual?(room?.cn||scenes[id].label||'未知地点'):'未知地点',
      name:visual&&typeof room?.name==='string'?room.name:'',current:id===raw.room,visual,unknownVisual:!visual,exits:[]};
  });
  const byId=new Map(nodes.map(node=>[node.id,node]));
  for(const id of ids){
    const room=definitions[id],view=roomView(raw,id);
    let exits;
    try{exits=typeof room?.exits==='function'?room.exits(view):room?.exits||{};}
    catch{warnings.push({room:id,reason:'exits-unavailable'});continue;}
    for(const direction of DIRECTION_ORDER){
      const exit=exits?.[direction],to=typeof exit==='string'?exit:exit?.to;
      if(typeof to!=='string'||!known.has(to)||owners[to]!==selected)continue;
      try{if(typeof exit?.when==='function'&&!exit.when(view))continue;if(exit?.when===false)continue;}
      catch{warnings.push({room:id,reason:'condition-unavailable'});continue;}
      const edge={id:`${id}:${direction}:${to}`,from:id,to,direction,label:DIRECTIONS[direction]};
      edges.push(edge);byId.get(id).exits.push({direction,label:edge.label,to,cn:byId.get(to).cn,name:byId.get(to).name});
    }
  }
  return {chapter:selected,chapterLabel:labels[selected]||'已探索章节',chapters,currentRoom:raw.room||null,
    nodes:layoutChapterMap(nodes,edges),edges,warnings,width:960,height:570};
}

const VIEW_STYLE=`
.chapter-map[hidden]{display:none!important}
.chapter-map{position:absolute;inset:0;z-index:50;display:grid;grid-template-rows:auto minmax(0,1fr) auto;overflow:hidden;background:#1b2a23;color:#eee2c5;font-family:Georgia,'Songti SC',serif;isolation:isolate;border:1px solid #a58e59;box-shadow:inset 0 0 0 5px #1a2920,inset 0 0 0 6px #82754e}
.chapter-map *{box-sizing:border-box}.chapter-map button,.chapter-map select{font:inherit;color:inherit;border:1px solid #a38d5b88;background:#26392c;border-radius:0;min-height:32px;padding:4px 10px;cursor:pointer}.chapter-map button:hover,.chapter-map button:focus-visible,.chapter-map select:focus-visible{outline:1px solid #e2c58c;outline-offset:2px;background:#3a4932}.chapter-map-heading{display:flex;align-items:center;gap:14px;padding:11px 20px 10px;border-bottom:1px solid #9a895457;min-width:0;background:linear-gradient(90deg,#21352a,#18291f)}.chapter-map h2{margin:0;font-size:17px;letter-spacing:.12em;font-weight:500;white-space:nowrap}.chapter-map .chapter-map-chapter{font-size:13px;max-width:130px}.chapter-map .chapter-map-chapter:disabled{opacity:1;appearance:none;border:0;padding-left:0;background:transparent}.chapter-map-status{font-size:11px;color:#bdb692;margin-left:auto;white-space:nowrap}.chapter-map-close{font-size:12px!important}.chapter-map-viewport{position:relative;min-width:0;min-height:0;overflow:hidden;background:#a7ab87;touch-action:none;cursor:grab}.chapter-map-viewport[data-dragging=true]{cursor:grabbing}.chapter-map-viewport:focus-visible{outline:2px solid #e2c58c;outline-offset:-3px}.chapter-map svg{display:block;width:100%;height:100%;user-select:none;-webkit-user-select:none}.chapter-map .map-chart{transform-box:view-box;transform-origin:0 0}.chapter-map .map-roads{pointer-events:none}.chapter-map .map-road-border{fill:none;stroke:#687553;stroke-width:10;opacity:.62;stroke-linecap:round;stroke-linejoin:round}.chapter-map .map-road{fill:none;stroke:#ddd0a1;stroke-width:6;stroke-linecap:round;stroke-linejoin:round}.chapter-map .map-road[data-active=true]{stroke:#f4e1a2;stroke-width:7}.chapter-map .map-connection{fill:none;stroke:#435d4d;stroke-width:2;stroke-dasharray:4 6;opacity:0;pointer-events:none}.chapter-map .map-connection[data-active=true]{opacity:.9}.chapter-map .map-node{cursor:pointer;outline:none}.chapter-map .map-node .map-marker{fill:#344d38;stroke:#e6dcaf;stroke-width:1.3}.chapter-map .map-node .map-symbol{fill:none;stroke:#ece3ba;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round;pointer-events:none}.chapter-map .map-node:hover .map-marker,.chapter-map .map-node:focus-visible .map-marker,.chapter-map .map-node[aria-pressed=true] .map-marker{fill:#526846;stroke:#fff0bc;stroke-width:2.5}.chapter-map .map-node .map-label{font-size:15px;fill:#263d2c;stroke:#c3c4a0;stroke-width:5;paint-order:stroke;stroke-linejoin:round;text-anchor:middle;pointer-events:none}.chapter-map .map-node[data-current=true] .map-label{font-weight:bold}.chapter-map .map-current-ring{fill:none;stroke:#f9e7a9;stroke-width:2}.chapter-map .map-player{fill:#ffe8a2;stroke:#47553b;stroke-width:1.2}.chapter-map .map-current-halo{fill:none;stroke:#5a7351;stroke-width:1;opacity:.55}.chapter-map .map-unknown{stroke-dasharray:2 3}.chapter-map-tools{position:absolute;right:16px;bottom:16px;display:flex;align-items:center;gap:1px;box-shadow:0 2px 10px #1f352433}.chapter-map-tools button{background:#23392de8;min-width:34px;height:32px;font:16px Georgia,serif;border-color:#8a916f}.chapter-map-tools .map-recenter{font-size:11px;padding:3px 10px}.chapter-map-legend{position:absolute;left:18px;top:14px;display:flex;align-items:center;gap:8px;font-size:11px;color:#46583c;pointer-events:none}.chapter-map-legend span:first-child::before{content:'◆';color:#40583a;margin-right:5px}.chapter-map-legend span:last-child::before{content:'➤';color:#746439;margin:0 5px 0 6px}.chapter-map-detail{display:flex;align-items:center;gap:18px;min-height:51px;padding:8px 20px;background:linear-gradient(90deg,#21352a,#18291f);border-top:1px solid #9a895457;min-width:0}.chapter-map-detail h3{font-size:14px;font-weight:500;margin:0;white-space:nowrap;color:#f0dfb0}.chapter-map-detail small{font-size:10px;color:#afa989;font-weight:normal;display:block;line-height:1.4}.chapter-map-detail p{font-size:11px;color:#bdb99b;margin:0;line-height:1.5}.chapter-map-detail .map-route-summary{display:flex;gap:5px 13px;flex-wrap:wrap;align-items:center;font-size:11px;color:#bdb99b}.chapter-map .map-note{font-size:10px;color:#d6c48f;margin-left:auto;max-width:220px}.chapter-map .map-touch-hint{position:absolute;right:17px;top:14px;color:#526244;font-size:10px;pointer-events:none}
@media(max-width:700px){.chapter-map-heading{padding:8px 12px;gap:10px}.chapter-map h2{font-size:15px}.chapter-map-status{display:none}.chapter-map-close{margin-left:auto}.chapter-map-detail{padding:7px 12px;gap:12px;min-height:45px}.chapter-map-detail h3{font-size:12px}.chapter-map-detail .map-route-summary{font-size:10px;gap:3px 9px}.chapter-map .map-note{font-size:9px;max-width:150px}.chapter-map-legend{left:12px;top:10px;font-size:10px}.chapter-map .map-touch-hint{display:none}.chapter-map-tools{right:10px;bottom:10px}}
@media(max-height:450px){.chapter-map-heading{padding:5px 12px}.chapter-map-heading button,.chapter-map-heading select{min-height:27px}.chapter-map h2{font-size:14px}.chapter-map-detail{min-height:37px;padding:5px 12px}.chapter-map-detail small{display:none}.chapter-map-legend{top:8px}.chapter-map-tools{bottom:8px}}
`;
let viewSerial=0;

/** Map remains inside the game stage; only view state changes on open/select. */
export function createChapterMapView({host,document:providedDocument,onClose=()=>{},onSelect=()=>{}}={}){
  const doc=providedDocument||host?.ownerDocument||globalThis.document;
  if(!doc?.createElement)throw new Error('地图界面需要文档容器。');
  const mount=host||doc.body,ns='http://www.w3.org/2000/svg',uid=`chapter-map-${++viewSerial}`;
  const el=(tag,text)=>{const node=doc.createElement(tag);if(text!==undefined)node.textContent=text;return node;};
  const svgEl=(tag,attrs={})=>{const node=doc.createElementNS(ns,tag);for(const [key,value]of Object.entries(attrs))node.setAttribute(key,String(value));return node;};
  const root=el('section');root.className='chapter-map';root.hidden=true;root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-labelledby',`${uid}-title`);
  const style=el('style',VIEW_STYLE),heading=el('header');heading.className='chapter-map-heading';
  const title=el('h2','探索地图');title.id=`${uid}-title`;
  const chapterSelect=el('select');chapterSelect.className='chapter-map-chapter';chapterSelect.setAttribute('aria-label','选择已探索章节');
  const status=el('span');status.className='chapter-map-status';
  const closeButton=el('button','收起 · M / Esc');closeButton.className='chapter-map-close';closeButton.type='button';closeButton.setAttribute('aria-label','关闭地图');
  heading.append(title,chapterSelect,status,closeButton);
  const svg=svgEl('svg',{viewBox:`0 0 ${MAP_SIZE.width} ${MAP_SIZE.height}`,role:'group','aria-label':'章节地形与已探索地点'});
  const viewport=el('div');viewport.className='chapter-map-viewport';viewport.tabIndex=0;viewport.setAttribute('aria-label','地图画布，可拖动、滚轮缩放；方向键平移，加减号缩放');viewport.append(svg);
  const legend=el('div');legend.className='chapter-map-legend';legend.append(el('span','已探索'),el('span','当前位置'));
  const hint=el('span','拖动查看 · 滚轮缩放');hint.className='map-touch-hint';
  const tools=el('div');tools.className='chapter-map-tools';tools.setAttribute('role','group');tools.setAttribute('aria-label','地图视图控制');
  const zoomOut=el('button','−'),zoomIn=el('button','＋'),resetButton=el('button','全图'),locateButton=el('button','定位');
  for(const [button,label]of [[zoomOut,'缩小地图'],[zoomIn,'放大地图'],[resetButton,'恢复全图'],[locateButton,'定位当前位置']]){button.type='button';button.setAttribute('aria-label',label);}
  resetButton.className=locateButton.className='map-recenter';tools.append(zoomOut,zoomIn,resetButton,locateButton);viewport.append(legend,hint,tools);
  const detail=el('footer');detail.className='chapter-map-detail';detail.setAttribute('aria-live','polite');
  root.append(style,heading,viewport,detail);mount.append(root);
  let model=null,source=null,selected=null,previousFocus=null,chart=null,nodes=[],zoom=1,pan={x:0,y:0},drag=null,frameWidth=1080,overview=false;
  function fitFrame(){
    const ratio=viewport.clientWidth/Math.max(1,viewport.clientHeight);
    frameWidth=!overview&&ratio<1.15?Math.max(300,680*ratio):1080;
    svg.setAttribute('viewBox',`${(1080-frameWidth)/2} 0 ${frameWidth} 680`);transform();
  }
  function data(input){if(input&&Array.isArray(input.nodes)&&Array.isArray(input.edges)){source=null;return input;}source=input||{};return buildChapterMap(source);}
  function transform(){
    const limitX=(MAP_SIZE.width*zoom-frameWidth)/2+50,limitY=MAP_SIZE.height*(zoom-1)/2+50;
    pan.x=Math.max(-limitX,Math.min(limitX,pan.x));pan.y=Math.max(-limitY,Math.min(limitY,pan.y));
    chart?.setAttribute('transform',`translate(${pan.x} ${pan.y}) translate(540 340) scale(${zoom}) translate(-540 -340)`);
    zoomOut.disabled=zoom<=1;zoomIn.disabled=zoom>=3;
  }
  function scale(next,point={x:540,y:340}){
    next=Math.max(1,Math.min(3,next));
    const ratio=next/zoom;pan={x:point.x-540-(point.x-540-pan.x)*ratio,y:point.y-340-(point.y-340-pan.y)*ratio};zoom=next;transform();
  }
  function reset(){overview=true;zoom=1;pan={x:0,y:0};fitFrame();}
  function locate(){const node=nodes.find(entry=>entry.current)||nodes.find(entry=>entry.id===selected);if(!node)return;overview=false;fitFrame();zoom=Math.max(frameWidth<1080?1:1.5,zoom);pan={x:(540-node.x)*zoom,y:(340-node.y)*zoom};transform();}
  function select(id,{focus=false}={}){
    const node=nodes.find(entry=>entry.id===id);if(!node)return false;selected=id;
    for(const group of svg.querySelectorAll('[data-room-id]')){const active=group.getAttribute('data-room-id')===id;group.setAttribute('aria-pressed',String(active));if(active&&focus)group.focus();}
    for(const edge of svg.querySelectorAll('[data-from]'))edge.setAttribute('data-active',String(edge.getAttribute('data-from')===id||edge.getAttribute('data-to')===id));
    const name=el('h3',node.cn+(node.current?' · 你在这里':''));if(node.name)name.append(el('small',node.name));detail.replaceChildren(name);
    const summary=el('div');summary.className='map-route-summary';
    if(node.exits.length){for(const exit of node.exits)summary.append(el('span',`${exit.label} · ${exit.cn}`));}
    else summary.append(el('span','沿途探索后，路线会逐渐记下。'));
    detail.append(summary);
    const atypical=model.edges.some(edge=>edge.from===id&&chartConnection(edge,nodes,model.chapter,model.edges)?.schematic);
    if(atypical){const note=el('p','虚线为方位变化或高低连接，请以出口方向为准。');note.className='map-note';detail.append(note);}
    onSelect({id,chapter:model.chapter});return true;
  }
  function paint(){
    chapterSelect.replaceChildren();for(const chapter of model.chapters){const option=el('option',chapter.label);option.value=chapter.id;chapterSelect.append(option);}
    chapterSelect.value=model.chapter||'';chapterSelect.disabled=!source||model.chapters.length<2;
    status.textContent=`已探索 ${model.nodes.length} 处`;nodes=illustratedMapNodes(model);
    svg.replaceChildren();chart=svgEl('g',{class:'map-chart'});const terrain=svgEl('g',{'aria-hidden':true});terrain.innerHTML=terrainMarkup(model.chapter,uid,nodes);chart.append(terrain);svg.append(chart);
    const roads=svgEl('g',{class:'map-roads','aria-hidden':true}),connections=svgEl('g',{class:'map-connections','aria-hidden':true}),seen=new Set();
    for(const edge of model.edges){
      const connection=chartConnection(edge,nodes,model.chapter,model.edges);if(!connection)continue;
      const {from,to,road}=connection,key=[from.id,to.id].sort(compare).join('|');
      const path=from===to?`M ${from.x+8} ${from.y-8} c 45 -45 -45 -45 -16 0`:chartRoadPath(from,to,model.chapter);
      if(road){if(seen.has(key))continue;seen.add(key);roads.append(svgEl('path',{d:path,class:'map-road-border'}),svgEl('path',{d:path,class:'map-road','data-from':from.id,'data-to':to.id}));}
      else connections.append(svgEl('path',{d:path,class:'map-connection','data-edge-id':edge.id,'data-from':from.id,'data-to':to.id}));
    }
    chart.append(roads,connections);
    for(const node of nodes){
      const group=svgEl('g',{class:'map-node',transform:`translate(${node.x} ${node.y})`,role:'button',tabindex:0,'data-room-id':node.id,'data-current':node.current,'data-unknown':node.unknownVisual,'aria-label':node.cn+(node.current?' · 当前位置':''),'aria-pressed':false});
      group.append(svgEl('circle',{r:24,fill:'transparent'}));
      if(node.current)group.append(svgEl('circle',{r:26,class:'map-current-halo'}),svgEl('circle',{r:21,class:'map-current-ring'}));
      group.append(svgEl('circle',{r:15,class:`map-marker${node.unknownVisual?' map-unknown':''}`}));
      group.append(svgEl('path',{d:mapIconPath(node.unknownVisual?'place':node.icon),class:'map-symbol'}));
      const label=svgEl('text',{y:37,class:'map-label'});label.textContent=node.cn;group.append(label);
      if(node.current)group.append(svgEl('path',{d:'M 0 -31 L -6 -43 L 0 -40 L 6 -43 Z',class:'map-player'}));
      group.addEventListener('click',()=>select(node.id));group.addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key)){event.preventDefault();event.stopPropagation();select(node.id);}});chart.append(group);
    }
    const id=nodes.some(node=>node.id===selected)?selected:nodes.find(node=>node.current)?.id||nodes[0]?.id;
    if(id)select(id);else detail.replaceChildren(el('p','这里还没有探索记录。'));transform();
  }
  function update(input){model=data(input);paint();return model;}
  function open(input){previousFocus=root.hidden?doc.activeElement:previousFocus;overview=false;zoom=1;pan={x:0,y:0};selected=null;update(input);root.hidden=false;fitFrame();if(frameWidth<1080)locate();closeButton.focus();return model;}
  function close(reason='close'){if(root.hidden)return false;root.hidden=true;drag=null;viewport.dataset.dragging='false';if(previousFocus?.isConnected)previousFocus.focus?.();onClose({reason});return true;}
  function point(event){const value=svg.createSVGPoint();value.x=event.clientX;value.y=event.clientY;return value.matrixTransform(svg.getScreenCTM().inverse());}
  closeButton.addEventListener('click',()=>close('button'));zoomIn.addEventListener('click',()=>scale(zoom+.25));zoomOut.addEventListener('click',()=>scale(zoom-.25));resetButton.addEventListener('click',reset);locateButton.addEventListener('click',locate);
  svg.addEventListener('pointerdown',event=>{if(event.button!==0||event.target.closest('[data-room-id]'))return;const p=point(event);drag={id:event.pointerId,x:p.x,y:p.y,pan:{...pan}};svg.setPointerCapture(event.pointerId);viewport.dataset.dragging='true';event.preventDefault();});
  svg.addEventListener('pointermove',event=>{if(!drag||event.pointerId!==drag.id)return;const p=point(event);pan={x:drag.pan.x+p.x-drag.x,y:drag.pan.y+p.y-drag.y};transform();});
  const finishDrag=()=>{drag=null;viewport.dataset.dragging='false';};svg.addEventListener('pointerup',finishDrag);svg.addEventListener('pointercancel',finishDrag);svg.addEventListener('lostpointercapture',finishDrag);
  viewport.addEventListener('wheel',event=>{event.preventDefault();scale(zoom*(event.deltaY<0?1.12:1/1.12),point(event));},{passive:false});
  viewport.addEventListener('keydown',event=>{if(event.target!==viewport)return;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();event.stopPropagation();const dx=event.key==='ArrowLeft'?40:event.key==='ArrowRight'?-40:0,dy=event.key==='ArrowUp'?40:event.key==='ArrowDown'?-40:0;pan={x:pan.x+dx,y:pan.y+dy};transform();}else if(['+','=','-','0','Home'].includes(event.key)){event.preventDefault();event.stopPropagation();if(event.key==='0'||event.key==='Home')reset();else scale(zoom+(event.key==='-'?-.25:.25));}});
  root.addEventListener('keydown',event=>{
    if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close('escape');}
    if(event.key==='Tab'){const items=[chapterSelect,closeButton,viewport,zoomOut,zoomIn,resetButton,locateButton,...svg.querySelectorAll('[data-room-id]')].filter(item=>!item.disabled);const at=items.indexOf(doc.activeElement),next=(at+(event.shiftKey?-1:1)+items.length)%items.length;event.preventDefault();items[next].focus();}
  });
  chapterSelect.addEventListener('change',()=>{if(source){const next={...source,chapter:chapterSelect.value};model=buildChapterMap(next);source=next;selected=null;reset();paint();}});
  const Resize=doc.defaultView?.ResizeObserver;const observer=Resize?new Resize(()=>{if(!root.hidden)fitFrame();}):null;observer?.observe(viewport);
  return {element:root,open,update,close,select,isOpen:()=>!root.hidden,
    getState:()=>({open:!root.hidden,chapter:model?.chapter||null,selected,nodes:model?.nodes.length||0,zoom:Math.round(zoom*100)/100,pan:{x:Math.round(pan.x),y:Math.round(pan.y)}}),
    destroy(){observer?.disconnect();root.remove();model=null;source=null;}};
}
