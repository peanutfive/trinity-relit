// Original vector cartography for this game. Terrain is a spoiler-free visual
// reference; only chapter-map.js may add discovered place names and real links.
const path=(d,fill,stroke='#43513d',width=1.3,extra='')=>`<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${width}" ${extra}/>`;
function random(seed){return ()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};}
function grove(x,y,rx,ry,count,seed){
  const rand=random(seed),trees=[];
  for(let i=0;i<count;i++){
    const angle=rand()*Math.PI*2,r=Math.sqrt(rand()),tx=x+Math.cos(angle)*rx*r,ty=y+Math.sin(angle)*ry*r,s=6+rand()*7;
    trees.push({x:tx,y:ty,s});
  }
  trees.sort((a,b)=>a.y-b.y);
  return trees.map(({x,y,s})=>`<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})" opacity=".76">${path(`M 0 7 v ${s*.7}`,'none','#52604a',.8)}${path(`M ${-s} 2 Q ${-s*1.3} ${-s*.65} ${-s*.35} ${-s*.9} Q 0 ${-s*1.8} ${s*.6} ${-s*.75} Q ${s*1.5} ${-s*.7} ${s*.85} 2 Q ${s*.4} ${s*.7} 0 ${s*.4} Q ${-s*.7} ${s*.8} ${-s} 2 Z`,iColor(s),'#53624a',.7)}${path(`M ${-s*.6} ${-s*.25} Q 0 ${-s*.75} ${s*.5} ${-s*.45}`,'none','#a4ae7e',.7)}</g>`).join('');
}
const iColor=s=>s>13?'#70815b':s>10?'#829169':'#939d72';
function paperFibres(){
  const rand=random(1986);let fibres='',flecks='';
  for(let i=0;i<92;i++){
    const x=rand()*180,y=rand()*160,length=.6+rand()*4.2;
    fibres+=`M ${x.toFixed(2)} ${y.toFixed(2)} q ${(length*.5).toFixed(2)} ${(rand()-.5).toFixed(2)} ${length.toFixed(2)} ${((rand()-.5)*1.6).toFixed(2)} `;
    if(i%3===0)flecks+=`M ${(rand()*180).toFixed(2)} ${(rand()*160).toFixed(2)} h .45 `;
  }
  return `<path d="${fibres}" fill="none" stroke="#5b6246" stroke-width=".42" opacity=".16"/><path d="${flecks}" stroke="#f2e5bb" stroke-width=".8" opacity=".28"/>`;
}
function grassInk(){
  const rand=random(354);let ink='';
  for(let i=0;i<120;i++){
    const x=140+rand()*705,y=105+rand()*474;
    if(Math.hypot((x-466)/122,(y-243)/98)<1||(x<250&&y>547))continue;
    ink+=`M ${x.toFixed(1)} ${y.toFixed(1)} l 3 -2 m 2 3 l 4 -3 `;
  }
  return path(ink,'none','#697951',.65,'opacity=".28"');
}
function flowerBed(x,y,w,h){return `<g transform="translate(${x} ${y})">${path(`M 0 0 h ${w} v ${h} h ${-w} Z`,'#9d9e73','#69704f',1.1)}${Array.from({length:Math.floor(w/10)},(_,i)=>path(`M ${i*10+5} 5 v ${h-10}`,'none','#c0b48a',2)).join('')}</g>`;}
function water(d,id){return `${path(d,`url(#${id}-water)`,'#4b665c',2)}${path(d,'none','#d1cfac',5,'opacity=".48" transform="translate(0 -3)"')}${path(d,`url(#${id}-ripples)`,'none',0)}`;}

const parkOutline='M 112 63 Q 75 68 68 115 L 77 360 Q 62 450 102 553 L 142 613 Q 371 645 609 622 L 768 627 Q 889 617 945 560 Q 1005 496 982 379 L 964 190 Q 943 79 843 60 L 671 43 Q 492 65 362 49 Z';
function garden(id){
  return `${path(parkOutline,'#a4ac82','#5b694d',3)}${path(parkOutline,'none','#d4d1aa',1,'transform="translate(0 -5)"')}
    ${path('M 115 84 Q 325 82 462 74 Q 692 59 826 87 Q 930 114 940 219 M 120 590 Q 347 619 584 595 Q 770 612 904 554','none','#6d7957',1.4,'stroke-dasharray="2 5"')}
    ${path('M 93 186 Q 86 294 101 362 M 99 374 Q 89 474 130 555 M 267 598 Q 423 617 567 609 M 794 608 Q 892 589 926 534','none','#65754e',.7,'opacity=".45"')}
    ${path('M 139 158 Q 165 190 141 260 L 130 433 Q 167 451 239 433 L 246 188 Z','#8d9d71','#7a8863',1)}
    ${path('M 274 158 Q 322 135 362 160 L 361 354 Q 305 377 271 356 Z','#bac092','#8f9970',1)}
    ${path('M 289 410 Q 370 390 430 417 Q 453 437 433 458 Q 347 480 285 449 Z','#9ba776','#7f8d62',1)}
    ${path('M 359 448 Q 404 411 464 415 Q 526 415 559 455 Q 577 499 527 519 Q 442 542 387 504 Z','#b7bd8b','#7e8e63',1.4)}
    ${flowerBed(555,385,80,25)}${flowerBed(540,537,105,27)}${flowerBed(595,448,58,30)}${flowerBed(776,520,55,20)}
    ${path('M 562 158 Q 625 131 671 160 L 680 228 Q 635 254 585 231 Z','#8e9c70','#79875f',1)}
    ${water('M 367 245 C 365 195 407 173 468 173 C 537 172 566 203 561 247 C 555 292 515 311 458 308 C 400 310 370 286 367 245 Z',id)}
    ${water('M 877 173 Q 899 153 916 176 Q 919 218 942 247 Q 969 286 951 320 Q 933 354 963 401 Q 986 455 955 515 Q 940 557 918 562 Q 902 539 921 495 Q 937 451 920 410 Q 893 365 914 323 Q 931 287 909 252 Q 882 224 877 173 Z',id)}
    ${path('M 357 235 C 360 189 401 162 468 164 C 532 160 575 191 571 241 M 358 254 C 362 292 402 319 458 319 C 516 322 553 305 571 267','none','#738461',.75,'opacity=".58"')}
    ${path('M 870 181 Q 874 218 899 251 M 977 285 Q 977 315 960 343 M 908 412 Q 925 449 908 489 M 963 526 Q 953 555 933 573','none','#6e8261',.75,'opacity=".58"')}
    <g fill="none" stroke="#bacbb4" stroke-width="1.2" opacity=".6"><path d="M 407 221 q 13 -5 26 0 m 27 0 q 13 -5 26 0 m -65 25 q 13 -5 26 0 m 27 0 q 13 -5 26 0 m -48 25 q 13 -5 26 0"/><path d="M 906 202 l 5 12 m 20 64 l 2 14 m 8 132 l 3 12 m -6 58 l -3 13"/></g>
    ${grove(119,170,31,85,34,12)}${grove(118,450,26,87,30,22)}${grove(290,104,73,21,27,31)}${grove(616,104,74,23,29,54)}
    ${grove(310,280,26,80,25,65)}${grove(632,285,41,60,36,87)}${grove(813,184,39,60,36,98)}${grove(812,425,34,65,30,101)}
    ${grove(303,540,33,35,20,213)}${grove(650,588,36,15,13,143)}${grove(842,580,27,22,15,155)}
    <g transform="translate(140 570)" stroke="#655f47" fill="#c2b58a" stroke-width="1.2"><path d="M -62 3 h 42 v -22 h 24 v 22 h 31 v -22 h 24 v 22 h 30 v 29 H -62 Z"/><path d="M -66 2 l 20 -12 h 23 m 60 0 h 23 l 22 12 M -58 34 h 148 M -49 13 v 10 m 11 -10 v 10 m 11 -10 v 10 m 49 -10 v 10 m 11 -10 v 10 m 11 -10 v 10 m 11 -10 v 10"/></g>
    <g fill="none" stroke="#7c8861" stroke-width=".9" opacity=".5"><path d="M 235 187 q 13 -4 19 0 m -17 15 q 13 -4 19 0 M 523 424 q 15 -5 28 0 m -25 12 q 15 -5 28 0 M 785 367 q 15 -5 28 0 m -25 12 q 15 -5 28 0"/></g>${grassInk()}`;
}
function wildland(id){
  return `${path('M 79 88 Q 253 40 428 64 Q 631 36 799 77 Q 960 98 995 277 Q 1008 494 924 597 Q 757 648 523 617 Q 333 659 139 586 Q 48 446 69 273 Z','#a3aa80','#61704f',3)}
    ${path('M 451 76 Q 510 150 510 222 L 618 271 Q 743 251 853 169 Q 911 114 947 173 L 985 311 Q 845 355 734 302 L 592 347 Q 501 348 455 282 Q 421 200 451 76 Z','#929674','#727958',1.8)}
    ${Array.from({length:6},(_,i)=>path(`M ${471+i*7} ${100+i*10} Q ${546+i*7} ${229+i*6} ${644+i*12} ${249+i*6} T ${922+i*5} ${207+i*8}`,'none','#b6b58e',1.2)).join('')}
    ${path('M 313 166 Q 401 133 447 197 L 434 395 Q 369 422 315 381 Z','#89967d','#768568',1)}
    ${Array.from({length:9},(_,i)=>path(`M ${326+i%3*35} ${190+Math.floor(i/3)*69} q 15 -7 26 0 m -25 10 q 15 -7 26 0`,'none','#b3b898',1.2)).join('')}
    ${water('M 755 275 Q 770 302 814 320 Q 868 351 829 402 Q 795 450 840 500 Q 896 563 849 622 L 887 624 Q 936 565 877 495 Q 839 451 870 409 Q 920 349 830 296 Q 790 280 786 257 Z',id)}
    ${grove(150,390,61,140,65,124)}${grove(625,426,92,32,58,134)}${grove(708,546,112,35,65,325)}${grove(227,577,58,27,25,751)}${grove(839,98,105,18,35,981)}
    ${path('M 166 186 l 34 -73 l 35 73 l -27 -12 l -17 8 Z','#a9ab85','#697655',1.4)}${path('M 194 144 l 6 -31 l 18 39 l -16 -7 Z','#d1cdb0','#899171',.6)}
    ${path('M 279 587 C 287 542 368 539 400 577 C 420 623 308 641 279 587 Z','#88916c','#73805d',1.8)}${path('M 296 589 Q 341 549 385 587 Q 343 615 296 589 Z','#aeb18a','#7c8864',1)}
    ${path('M 156 301 Q 203 270 245 305 Q 263 347 212 363 Q 164 369 153 335 Z','#bdc295','#869469',1)}
    ${Array.from({length:14},(_,i)=>path(`M ${450+i*13} ${326+(i%3)*8} l 4 17`,'none','#697458',1)).join('')}`;
}

function hillside(){
  return `${path('M 98 251 Q 145 156 302 151 Q 463 136 536 178 Q 675 119 819 179 Q 936 240 959 385 Q 930 519 790 552 Q 658 587 510 551 Q 316 586 157 498 Q 69 418 98 251 Z','#a9aa7e','#61704f',3)}
    ${Array.from({length:5},(_,i)=>path(`M ${132+i*14} ${265+i*24} Q 277 ${180+i*29} 452 ${222+i*34} T ${914-i*13} ${303+i*31}`,'none','#7e8863',1.2,'opacity=".5"')).join('')}
    ${path('M 365 340 L 365 170 M 365 340 L 365 539 M 365 340 L 151 340 M 365 340 L 730 340','none','#5c6151',12,'opacity=".65"')}
    ${path('M 309 312 Q 360 277 418 319 Q 446 354 404 375 Q 339 398 304 360 Z','#c6b58a','#8a8261',1.5)}
    ${path('M 683 312 Q 718 270 778 297 L 799 349 L 685 360 Z','#8b9271','#65704f',1.7)}
    ${path('M 710 351 V 321 Q 734 299 757 321 V 351 Z','#64674f','#4e5b43',1.2)}
    ${grove(201,220,67,48,23,1945)}${grove(604,245,68,48,25,127)}${grove(827,445,64,53,29,36)}${grove(236,453,61,43,19,471)}
    <g fill="#92987e" stroke="#737d63" stroke-width=".7" opacity=".55">${Array.from({length:18},(_,i)=>{const x=173+i*40,y=104+(i%4)*9,h=9+i%5*4;return `<path d="M ${x} ${y} v ${-h} h 23 v ${h} Z"/>`;}).join('')}</g>`;
}
/** SVG string contains only authored geometry and finite discovery coordinates. */
export function terrainMarkup(chapter,id,nodes=[]){
  const safeId=String(id).replace(/[^a-z0-9_-]/gi,'');
  const clear=nodes.filter(node=>Number.isFinite(node.x)&&Number.isFinite(node.y)).map(node=>`<ellipse cx="${node.x}" cy="${node.y}" rx="140" ry="112" fill="url(#${safeId}-clear)"/>`).join('');
  return `<defs>
    <radialGradient id="${safeId}-paper"><stop stop-color="#c5c6a1"/><stop offset=".75" stop-color="#b3b58e"/><stop offset="1" stop-color="#a5a984"/></radialGradient>
    <linearGradient id="${safeId}-water" x2="1" y2="1"><stop stop-color="#7b9a8b"/><stop offset="1" stop-color="#587a71"/></linearGradient>
    <pattern id="${safeId}-ripples" width="23" height="18" patternUnits="userSpaceOnUse"><path d="M 2 8 q 6 -3 12 0" fill="none" stroke="#bed0b5" stroke-width=".5" opacity=".25"/></pattern>
    <pattern id="${safeId}-grain" width="9" height="11" patternUnits="userSpaceOnUse"><path d="M 1 2 h 1 M 5 8 h 2" stroke="#4d6346" opacity=".09"/></pattern>
    <pattern id="${safeId}-fibres" width="180" height="160" patternUnits="userSpaceOnUse">${paperFibres()}</pattern>
    <radialGradient id="${safeId}-clear"><stop offset=".2" stop-color="black"/><stop offset="1" stop-color="black" stop-opacity="0"/></radialGradient>
    <mask id="${safeId}-mist"><rect width="1080" height="680" fill="white"/>${clear}</mask>
  </defs><rect width="1080" height="680" fill="url(#${safeId}-paper)"/>
  <g class="map-landscape">${chapter==='japan'?hillside():chapter==='wabe'?wildland(safeId):garden(safeId)}</g>
  <rect width="1080" height="680" fill="url(#${safeId}-grain)"/>
  <rect class="map-mist" width="1080" height="680" fill="#d1cfb2" opacity=".38" mask="url(#${safeId}-mist)"/>
  <rect width="1080" height="680" fill="url(#${safeId}-fibres)" pointer-events="none"/>
  <g transform="translate(1003 83)" stroke="#536346" fill="none" stroke-width="1"><circle r="25" opacity=".5"/><path d="M 0 -32 V 32 M -32 0 H 32" opacity=".4"/><path d="M 0 -25 L 6 10 L 0 5 L -6 10 Z" fill="#506145"/><path d="M 0 25 L 6 -10 L 0 -5 L -6 -10 Z" opacity=".5"/><text y="-39" text-anchor="middle" fill="#506145" stroke="none" font-size="13">北</text></g>
  <path d="M 40 613 v 12 h 100 v -12 M 90 619 v 6" fill="none" stroke="#566346" opacity=".6"/>
  <text x="40" y="644" font-size="11" fill="#566346" opacity=".8">地形示意 · 非等距</text>`;
}

const icons={
  gate:'M -9 6 V -7 H -4 V 6 M 4 6 V -7 H 9 V 6 M -4 -4 H 4 M -3 1 H 3',
  statue:'M -7 7 H 7 M -4 6 V 0 H 4 V 6 M 0 0 V -6 M -3 -4 H 3 M 0 -7 V -9',
  flower:'M 0 7 V 0 M -1 4 Q -8 -2 -6 -3 Q -1 -3 0 1 M 0 1 Q 7 -4 7 -1 Q 8 3 0 5 M -3 -5 a 3 3 0 1 0 6 0 a 3 3 0 1 0 -6 0',
  sundial:'M -8 4 a 8 4 0 1 0 16 0 a 8 4 0 1 0 -16 0 M -5 2 L 4 -7 V 2 Z',
  pond:'M -9 0 Q -6 -9 0 -8 Q 10 -8 9 0 Q 9 7 0 7 Q -9 7 -9 0 M -5 0 h 4 m 3 3 h 4',
  bench:'M -9 -4 H 9 V 1 H -9 Z M -10 3 H 10 M -7 4 V 8 M 7 4 V 8',
  tree:'M 0 8 V 0 M -6 2 Q -12 -3 -5 -6 Q -1 -14 4 -7 Q 12 -7 9 0 Q 6 6 0 2 Z',
  water:'M -9 -3 q 5 -4 9 0 t 9 0 M -9 3 q 5 -4 9 0 t 9 0',
  hill:'M -10 6 L -1 -9 L 10 6 Z M -4 -3 L 0 -1 L 3 -3',
  bog:'M -8 6 H 8 M -5 6 V -5 M 1 6 V -9 M 6 6 V -3 M -8 -2 L -5 2 M 4 -5 L 1 0',
  stairs:'M -9 8 H -4 V 3 H 1 V -2 H 6 V -7 H 10',
  arch:'M -8 8 V -1 a 8 8 0 0 1 16 0 V 8 M -5 8 V -1 a 5 5 0 0 1 10 0 V 8',
  house:'M -10 -1 L 0 -9 L 10 -1 M -7 -2 V 8 H 7 V -2 M -2 8 V 2 H 2 V 8',
  place:'M 0 -7 L 7 0 L 0 7 L -7 0 Z',
};
export function mapIconPath(kind){return icons[kind]||icons.place;}
