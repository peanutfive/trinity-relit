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
    ${path('M 839 217 C 854 167 948 166 981 210 C 1004 263 863 288 839 217 Z','#88916c','#73805d',1.8)}${path('M 861 220 Q 907 175 957 216 Q 922 261 861 220 Z','#aeb18a','#7c8864',1)}
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
function caveChart(){
  return `${path('M 83 249 Q 119 207 201 224 L 282 229 Q 353 225 383 269 L 445 266 Q 490 213 552 229 L 626 239 Q 673 233 702 271 L 777 264 Q 807 212 899 234 Q 963 250 976 311 L 962 412 Q 934 454 862 450 Q 791 452 759 415 L 699 409 Q 668 456 588 450 L 488 450 Q 447 447 420 414 L 362 416 Q 329 461 248 452 L 146 442 Q 81 427 78 371 Z','#999e80','#5b6656',3)}
    ${path('M 145 292 Q 207 278 281 304 L 436 335 Q 552 304 638 336 L 785 332 Q 846 293 921 323 L 919 381 Q 850 410 789 376 L 639 382 Q 549 412 437 378 L 284 363 Q 204 389 143 359 Z','#c4bb93','#70765b',1.5)}
    ${Array.from({length:8},(_,i)=>path(`M ${104+i*116} 250 l 15 -16 l 22 20 m -22 184 l 24 10 l 17 -20`,'none','#7b826b',2)).join('')}
    ${path('M 186 418 l 12 -16 l 16 21 l 13 -18 l 17 18 M 505 270 q 25 -20 61 0 M 500 278 q 27 -20 66 0 M 827 281 l 19 -13 l 18 15','none','#6a735e',1.2)}
    <ellipse cx="864" cy="345" rx="13" ry="10" fill="#a9a78a" stroke="#69735c" stroke-width="1.5"/>`;
}
function orbitChart(id,nodes){
  const rand=random(124425);
  const stars=Array.from({length:116},(_,index)=>{
    const x=45+rand()*990,y=38+rand()*610,r=index%13===0?1.7:.45+rand()*.7;
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="#d9d6ba" opacity="${(.24+rand()*.42).toFixed(2)}"/>`;
  }).join('');
  const clear=nodes.filter(node=>Number.isFinite(node.x)&&Number.isFinite(node.y)).map(node=>`<ellipse cx="${node.x}" cy="${node.y}" rx="170" ry="140" fill="url(#${id}-clear)"/>`).join('');
  return `<defs>
    <radialGradient id="${id}-space" cx=".47" cy=".7" r=".85"><stop stop-color="#34474a"/><stop offset="1" stop-color="#14232a"/></radialGradient>
    <linearGradient id="${id}-earth" x2=".15" y2="1"><stop stop-color="#91a6a0"/><stop offset=".24" stop-color="#547a76"/><stop offset="1" stop-color="#304e55"/></linearGradient>
    <linearGradient id="${id}-limb" x2="1" y2="0"><stop stop-color="#8a727b"/><stop offset=".5" stop-color="#bc9387"/><stop offset="1" stop-color="#6b738c"/></linearGradient>
    <radialGradient id="${id}-clear"><stop offset=".2" stop-color="black"/><stop offset="1" stop-color="black" stop-opacity="0"/></radialGradient>
    <clipPath id="${id}-planet"><circle cx="540" cy="940" r="550"/></clipPath>
    <mask id="${id}-mist"><rect width="1080" height="680" fill="white"/>${clear}</mask>
    <pattern id="${id}-fibres" width="180" height="160" patternUnits="userSpaceOnUse">${paperFibres()}</pattern>
  </defs>
  <rect width="1080" height="680" fill="url(#${id}-space)"/>
  <g class="map-landscape map-orbit-chart">
    <g class="map-stars">${stars}</g>
    <path d="M 83 610 A 583 583 0 0 1 997 610" fill="none" stroke="#607774" stroke-width="1" opacity=".28"/>
    <circle cx="540" cy="940" r="550" fill="url(#${id}-earth)" stroke="url(#${id}-limb)" stroke-width="7"/>
    <g clip-path="url(#${id}-planet)">
      ${path('M 172 543 L 255 505 L 303 521 L 351 466 L 410 478 L 454 423 L 519 407 L 563 439 L 632 418 L 665 460 L 729 468 L 758 518 L 833 520 L 889 577 L 842 606 L 775 581 L 732 602 L 668 563 L 609 589 L 548 551 L 488 571 L 429 537 L 373 565 L 320 544 L 277 582 L 212 569 Z','#b8c4b2','#8da69a',1.4,'opacity=".84"')}
      ${path('M 252 547 Q 395 425 535 439 Q 685 449 804 548 M 311 577 Q 441 475 555 485 Q 690 489 756 571 M 200 610 Q 427 571 524 609 T 894 635','none','#e1ddbf',2,'opacity=".39"')}
      ${Array.from({length:6},(_,i)=>path(`M ${250+i*88} ${507+(i%2)*22} l 18 9 l 28 -8 m -5 14 l 17 5`,'none','#d8dcc4',1,'opacity=".5"')).join('')}
      ${path('M 132 661 Q 355 565 541 593 Q 760 607 947 658','none','#90a79c',1.3,'opacity=".4"')}
    </g>
    <path d="M 195 511 A 550 550 0 0 1 885 511" fill="none" stroke="#c5b8a1" stroke-width="1" opacity=".45"/>
  </g>
  <rect class="map-mist" width="1080" height="680" fill="#13252b" opacity=".26" mask="url(#${id}-mist)"/>
  <rect width="1080" height="680" fill="url(#${id}-fibres)" opacity=".46" pointer-events="none"/>
  <path d="M 45 613 v 12 h 100 v -12 M 95 619 v 6" fill="none" stroke="#b2baa2" opacity=".55"/>
  <text x="45" y="644" font-size="11" fill="#c3c6ae" opacity=".8">轨道示意 · 非等距</text>`;
}
function tundraChart(id){
  const rand=random(18856);
  const cracks=Array.from({length:86},()=>{const x=75+rand()*720,y=215+rand()*390,l=5+rand()*16;return path(`M ${x.toFixed(1)} ${y.toFixed(1)} l ${l.toFixed(1)} -3 l 5 4 m -5 -4 l 2 -6`,'none','#849283',.6,'opacity=".28"');}).join('');
  return `<g class="map-tundra-chart">
    ${path('M 52 216 L 86 153 L 127 166 L 181 90 L 236 129 L 287 101 L 332 127 L 383 75 L 435 115 L 479 91 L 524 133 L 572 84 L 621 130 L 677 104 L 722 145 L 787 122 L 818 186 L 832 617 L 61 619 Z','#a6b0a0','#728574',2)}
    ${path('M 78 226 L 130 186 L 178 143 L 215 178 L 277 155 L 325 183 L 383 125 L 427 163 L 481 143 L 525 181 L 572 139 L 616 175 L 678 153 L 717 191 L 776 174 L 804 229','none','#d5d5ba',3)}
    ${path('M 79 258 Q 201 229 315 251 T 564 244 T 797 263 L 811 602 Q 663 589 539 609 Q 340 585 77 609 Z','#b8b9a0','#9ba68f',1)}
    ${cracks}
    ${path('M 423 308 l 41 -2 l 16 16 l -3 63 l -46 3 l -17 -15 Z','#939f90','#657e70',1.5)}
    ${path('M 434 314 v 64 M 448 312 v 66 M 463 312 v 64 M 418 337 h 59 M 418 360 h 59 M 421 384 L 307 471','none','#6d8374',1.2)}
    ${path('M 870 94 L 924 67 L 1026 75 L 1050 117 L 1034 210 L 1024 251 L 1011 414 L 896 419 L 882 274 Z','#a4afa0','#6b8375',2)}
    ${path('M 890 121 l 29 -20 l 26 8 l 32 -16 l 47 13 M 900 139 l 25 -15 l 20 9 l 34 -14 l 43 12','none','#d5d6c0',1.5)}
    ${path('M 921 270 L 1007 270 L 1017 304 V 399 L 934 401 L 921 372 Z','#8b9c91','#5b756b',1.5)}
    ${path('M 933 282 H 1003 M 933 294 H 1006 M 934 304 H 1008 M 935 317 H 1010 M 936 333 H 1010 M 935 352 H 1010 M 935 374 H 1010 M 943 276 V 395 M 968 273 V 397 M 993 275 V 397','none','#c1c7b0',.7)}
    ${path('M 873 69 Q 921 39 969 50 T 1055 59 M 864 54 Q 914 21 974 34 T 1055 42','none','#73988b',1,'opacity=".55"')}
  </g>`;
}
function pacificChart(id){
  const shore='M 532 72 Q 592 48 649 70 L 676 65 Q 704 67 717 90 L 755 102 L 775 131 Q 833 141 857 188 L 875 203 L 870 227 Q 926 265 923 308 L 937 332 L 923 363 Q 928 411 900 433 L 894 462 L 856 479 Q 843 517 803 524 L 779 547 L 745 545 Q 694 586 650 584 L 625 600 L 593 590 Q 540 609 502 581 L 471 585 L 439 560 Q 385 548 368 508 L 341 499 L 332 463 Q 294 444 296 411 L 278 389 L 288 357 Q 269 318 293 285 L 288 258 L 314 237 Q 317 193 351 177 L 368 151 L 397 149 Q 425 113 466 108 L 484 85 L 513 88 Z';
  return `<g class="map-pacific-chart">
    <rect width="1080" height="680" fill="url(#${id}-water)"/>
    ${path(shore,'#b9b492','#718771',16)}
    ${path(shore,'#d3c39b','#e0d0a6',4)}
    ${path('M 509 150 Q 615 115 717 176 Q 808 214 841 305 Q 864 397 787 467 Q 709 533 598 535 Q 469 532 400 448 Q 331 366 382 270 Q 411 189 509 150 Z','#a3aa7d','#8d9972',2)}
    ${path('M 527 196 L 684 196 L 720 221 L 720 414 L 682 443 L 502 443 L 477 415 L 477 232 Z','#a7a486','#647462',2)}
    ${path('M 502 235 H 684 V 413 H 502 Z','#c5bd97','#6a7962',1.5)}
    ${path('M 504 314 H 682 M 544 235 V 412 M 638 235 V 412 M 507 239 L 676 407 M 676 239 L 507 407','none','#7f886b',1,'opacity=".5"')}
    ${Array.from({length:14},(_,i)=>path(`M ${510+i*12} 240 V 407`,'none','#8f9476',.6,'opacity=".45"')).join('')}
    ${path('M 521 208 h 145 l 28 18 M 486 246 v 155 l 20 25 M 707 246 v 155 l -20 25','none','#ddd0a4',1.6,'opacity=".65"')}
    ${path('M 532 211 v 16 h 23 v -16 M 649 211 v 16 h 22 v -16 M 515 421 v 9 h 36 v -9 M 649 421 v 9 h 36 v -9','none','#697a60',1.1)}
    ${path('M 600 265 V 370 M 593 276 H 607 M 593 286 H 607 M 593 296 H 607 M 593 306 H 607 M 593 316 H 607 M 593 326 H 607 M 593 336 H 607 M 593 346 H 607','none','#65785f',1.4)}
    ${path('M 52 154 L 93 125 L 166 130 L 202 159 L 184 192 L 115 205 L 65 186 Z','#979e7e','#64745d',2)}
    ${path('M 65 187 L 71 225 L 116 245 L 181 221 L 184 192 M 93 201 L 96 233 M 151 199 L 147 232','none','#64745d',1.4)}
    ${path('M 235 98 Q 210 188 231 265 M 245 91 Q 220 180 241 258','none','#b5c0a2',1,'opacity=".55"')}
    ${path('M 416 151 l -14 16 l 20 -6 l 13 -15 Z M 818 216 l 13 17 l 14 1 l -17 -24 Z M 887 383 l -3 23 l -16 12 l 4 -24 Z M 744 543 l 19 -13 l 12 4 l -19 14 Z M 397 496 l -18 -23 l 6 -14 l 19 29 Z M 331 273 l 14 -17 l -2 24 l -15 15 Z','#a2a380','#6c7e64',1)}
    ${path('M 457 123 l -10 11 m 24 -5 l -10 10 m 26 -12 l -9 10 M 812 177 l 10 12 m -1 4 l 11 14 M 917 313 l -9 10 m 7 6 l -10 10 M 807 505 l -12 6 m -5 6 l -12 4 M 559 583 l -9 -7 m -8 7 l -11 -7 M 320 418 l 7 12 m -2 -29 l 6 12','none','#7d8b6b',.8)}
    ${Array.from({length:20},(_,i)=>{const x=35+(i*137)%1000,y=40+(i*83)%590;return path(`M ${x} ${y} q 14 -5 28 0 t 28 0`,'none','#c5d0b4',.7,'opacity=".2"');}).join('')}
  </g>`;
}
function isletChart(id){
  // A continuous tongue of sand joins the upstream bar to the broader island.
  const shore='M 610 75 C 643 76 637 103 612 132 Q 581 165 599 194 Q 626 218 603 241 C 579 266 558 279 557 308 Q 554 341 592 359 Q 637 374 675 394 Q 718 418 711 461 C 705 494 658 517 620 526 Q 588 541 550 565 Q 510 593 466 571 Q 436 557 401 546 Q 358 536 339 504 Q 319 470 343 433 Q 364 389 412 376 C 454 363 490 347 501 316 Q 512 286 495 259 Q 473 226 492 194 Q 503 173 518 161 Q 548 143 557 120 Q 574 84 610 75 Z';
  return `<g class="map-islet-chart">
    <rect width="1080" height="680" fill="url(#${id}-water)"/>
    <rect width="1080" height="680" fill="url(#${id}-ripples)"/>
    ${path(shore,'none','#ccd4bb',18,'opacity=".40"')}
    ${path(shore,'#ccb889','#718979',3)}
    ${path(shore,'none','#e0d1a5',3,'transform="translate(0 -3)"')}
    ${path('M 606 91 Q 599 115 569 151 Q 541 180 541 202 M 507 225 Q 498 251 519 276 Q 534 310 512 343 M 360 463 Q 376 416 423 404 Q 470 392 491 365 M 378 508 Q 402 517 430 532 M 572 545 Q 601 521 646 508 Q 687 493 698 463','none','#a28d6b',2,'opacity=".78"')}
    ${path('M 412 428 q 5 -12 10 -14 l -4 11 l 10 -8 m 7 4 q 4 -9 7 -11 l -2 8 M 647 441 l 5 -14 l 1 11 l 8 -11 m 0 14 l 8 -9 M 512 204 l 4 -11 l 1 8 l 7 -7','none','#84845b',1.6)}
    ${path('M 173 294 C 229 310 281 305 332 278 M 177 307 C 222 322 256 319 289 308 M 754 237 Q 795 207 852 214 M 797 227 Q 835 215 864 222 M 689 564 Q 751 542 777 510','none','#c5d4bc',1.5,'opacity=".6"')}
  </g>`;
}

function desertChart(){
  const basin='M 400 333 C 398 295 440 272 489 264 Q 547 250 612 270 C 668 282 702 310 693 343 Q 679 386 626 402 Q 559 419 479 400 C 435 390 400 367 400 333 Z';
  return `<g class="map-desert-chart">
    <rect width="1080" height="680" fill="#c7b488"/>
    ${path('M 0 165 Q 106 132 206 145 Q 342 158 441 123 T 665 97 Q 793 104 886 71 Q 1005 38 1080 53 L 1080 0 H 0 Z','#b09d75','#a28f6c',1.4)}
    ${path('M 0 568 Q 126 515 232 544 Q 362 580 495 543 Q 633 511 766 533 Q 912 552 1080 483 V 680 H 0 Z','#d3bd8d','#bba276',1.6)}
    ${path('M 75 232 C 168 211 221 226 293 209 M 103 241 Q 184 223 233 232 M 772 249 Q 864 229 979 250 M 821 257 Q 897 248 943 258 M 94 461 Q 184 432 279 458 M 127 467 Q 193 456 231 466 M 767 444 Q 886 411 1025 432','none','#ad946d',1.6)}
    <g class="map-desert-foothills">
      ${path('M 106 299 Q 125 284 146 304 L 164 326 L 177 322 L 203 358 L 225 367 L 226 391 Q 245 413 250 442 L 268 458 L 266 476 Q 293 494 297 525 L 319 555 L 322 579 Q 349 600 335 622 L 268 634 L 216 620 Q 176 598 169 569 L 158 547 L 162 525 Q 135 495 137 468 L 122 448 L 125 426 Q 106 397 112 361 L 96 335 Z','#bbad85','#a39272',1.5)}
      ${path('M 109 319 Q 137 316 148 345 L 162 341 Q 175 363 189 368 L 196 393 M 131 387 Q 141 410 154 418 L 150 435 Q 174 459 178 479 M 213 416 L 221 452 L 243 469 L 247 493 M 181 520 Q 196 536 197 554 L 214 561 L 220 582 M 270 521 L 281 548 L 295 560 L 303 590','none','#958b6b',1.5)}
      ${path('M 111 324 L 127 322 L 143 347 M 147 403 L 162 415 L 159 431 M 206 417 L 215 451 L 233 467 M 191 518 L 201 539 L 207 551 M 272 540 L 288 562 L 294 582','none','#dbca9d',2.5)}
    </g>
    <g transform="translate(540 337) scale(.48 .68) translate(-540 -337)">
    ${path(basin,'#b49f78','#998463',2.4)}
    ${path('M 417 331 C 427 292 478 278 531 274 Q 615 270 660 302 M 686 340 Q 653 403 549 406 Q 457 400 420 359','none','#dec997',3)}
    ${path('M 446 330 C 458 301 510 291 551 292 Q 614 292 647 320 Q 664 350 617 370 Q 559 393 489 370 Q 443 354 446 330 Z','#c9b58b','#a18e6b',1.5)}
    ${path('M 455 315 l -9 -8 m 23 -1 l -7 -9 m 22 3 l -6 -11 m 23 5 l -4 -9 M 609 372 l 6 9 m 8 -15 l 7 8 m 5 -15 l 8 6 m 1 -13 l 9 3','none','#928162',1.3)}
    </g>
    ${path('M 646 187 Q 685 169 738 175 M 683 186 Q 713 180 749 181 M 753 390 Q 795 374 830 380 M 826 357 Q 885 336 919 344 M 385 500 Q 425 482 456 489','none','#b5a078',1.5)}
    ${path('M 148 377 l 4 -7 l 4 8 m 4 -3 l 6 -4 M 338 290 l 3 -8 l 4 7 l 5 -4 M 759 378 l 4 -10 l 4 9 l 5 -6 M 936 322 l 3 -7 l 2 7 l 6 -4 M 308 488 l 3 -6 l 5 7','none','#85815d',1.4)}
  </g>`;
}
function ranchChart(id){
  const yard='M 307 195 Q 370 175 496 189 L 558 203 Q 589 204 592 239 L 597 404 Q 597 449 554 454 L 330 463 Q 289 462 285 429 L 279 250 Q 277 211 307 195 Z';
  const reservoir='M 774 251 L 914 246 L 950 278 L 960 355 L 924 394 L 780 403 L 745 370 L 736 295 Z';
  return `<g class="map-ranch-perimeter">
    <rect width="1080" height="680" fill="#c3ae80"/>
    ${path('M 0 0 H 1080 V 141 Q 906 88 780 118 T 491 129 Q 315 154 204 122 Q 91 96 0 143 Z','#af9f7a','#a69672',1.5)}
    ${path('M 0 509 Q 91 485 165 527 T 355 578 Q 503 556 662 579 T 943 536 Q 1020 522 1080 551 V 680 H 0 Z','#c9b78f','#b6a27d',1.4)}
    ${path('M 56 157 Q 128 136 196 149 M 64 166 Q 131 149 167 154 M 731 122 Q 830 101 924 123 M 791 126 Q 862 114 911 126 M 64 498 Q 126 484 168 510 M 766 552 Q 850 541 904 516 M 818 555 Q 885 542 926 521','none','#a4916d',1.7)}
    ${path(yard,'#b3a67c','#726f5e',7)}${path(yard,'none','#d6caac',4)}
    ${path('M 355 209 L 495 203 L 505 374 L 309 387 L 302 291 L 354 286 Z','#857a64','#716854',2)}
    ${path('M 350 199 L 491 194 L 501 362 L 305 375 L 299 280 L 351 275 Z','#b19a7b','#776d59',2)}
    ${path('M 351 200 L 369 218 L 472 214 L 491 195 M 472 214 L 478 343 L 500 361 M 478 343 L 326 356 L 306 374 M 299 281 L 326 301 L 367 296 L 369 218','none','#7b715e',2)}
    ${path('M 492 303 L 511 301 L 514 327 L 495 329 Z','#c3b294','#877e67',1.8)}
    ${path(reservoir,'#a4997e','#787768',13)}${water(reservoir,id)}
    ${path('M 781 304 q 20 -6 38 -2 m 21 27 q 22 5 42 0 m 5 -48 q 17 -3 28 1','none','#bbcab3',1.8)}
  </g>`;
}
const chartPainters={prologue:garden,wabe:wildland,japan:hillside,underground:caveChart,
  pacific:pacificChart,tundra:tundraChart,islet:isletChart,desert:desertChart,ranch:ranchChart};

/** SVG string contains only authored geometry and finite discovery coordinates. */
export function terrainMarkup(chapter,id,nodes=[]){
  const safeId=String(id).replace(/[^a-z0-9_-]/gi,'');
  if(chapter==='orbit')return orbitChart(safeId,nodes);
  const paintChart=Object.hasOwn(chartPainters,chapter)?chartPainters[chapter]:garden;
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
  <g class="map-landscape">${paintChart(safeId)}</g>
  <rect width="1080" height="680" fill="url(#${safeId}-grain)"/>
  <rect class="map-mist" width="1080" height="680" fill="#d1cfb2" opacity=".38" mask="url(#${safeId}-mist)"/>
  <rect width="1080" height="680" fill="url(#${safeId}-fibres)" pointer-events="none"/>
  <g transform="translate(1003 83)" stroke="#536346" fill="none" stroke-width="1"><circle r="25" opacity=".5"/><path d="M 0 -32 V 32 M -32 0 H 32" opacity=".4"/><path d="M 0 -25 L 6 10 L 0 5 L -6 10 Z" fill="#506145"/><path d="M 0 25 L 6 -10 L 0 -5 L -6 -10 Z" opacity=".5"/><text y="-39" text-anchor="middle" fill="#506145" stroke="none" font-size="13">北</text></g>
  <g transform="translate(${chapter==='desert'?315:0} 0)">
    <path d="M 40 613 v 12 h 100 v -12 M 90 619 v 6" fill="none" stroke="#566346" opacity=".6"/>
    <text x="40" y="644" font-size="11" fill="#566346" opacity=".8">地形示意 · 非等距</text>
  </g>`;
}

const icons={
  lane:'M -7 8 L -4 -8 M 7 8 L 4 -8 M 0 -7 V -3 M 0 1 V 5',
  island:'M -10 4 Q -7 3 -5 0 Q -2 -7 3 -4 Q 5 -4 6 0 Q 8 3 10 4 Z M -7 7 Q -3 5 0 7 T 7 7',
  dune:'M -11 5 Q -4 5 1 -6 Q 4 0 10 2 M -4 6 Q 2 5 5 1',
  basin:'M -10 -3 Q -6 -5 -3 -5 M 2 -5 Q 8 -5 10 -1 Q 9 6 0 6 Q -7 6 -10 2 M -6 -1 Q -3 3 2 2 Q 5 2 7 -1',
  gate:'M -9 6 V -7 H -4 V 6 M 4 6 V -7 H 9 V 6 M -4 -4 H 4 M -3 1 H 3',
  statue:'M -7 7 H 7 M -4 6 V 0 H 4 V 6 M 0 0 V -6 M -3 -4 H 3 M 0 -7 V -9',
  flower:'M 0 7 V 0 M -1 4 Q -8 -2 -6 -3 Q -1 -3 0 1 M 0 1 Q 7 -4 7 -1 Q 8 3 0 5 M -3 -5 a 3 3 0 1 0 6 0 a 3 3 0 1 0 -6 0',
  sundial:'M -8 4 a 8 4 0 1 0 16 0 a 8 4 0 1 0 -16 0 M -5 2 L 4 -7 V 2 Z',
  pond:'M -9 0 Q -6 -9 0 -8 Q 10 -8 9 0 Q 9 7 0 7 Q -9 7 -9 0 M -5 0 h 4 m 3 3 h 4',
  bench:'M -9 -4 H 9 V 1 H -9 Z M -10 3 H 10 M -7 4 V 8 M 7 4 V 8',
  tree:'M 0 8 V 0 M -6 2 Q -12 -3 -5 -6 Q -1 -14 4 -7 Q 12 -7 9 0 Q 6 6 0 2 Z',
  water:'M -9 -3 q 5 -4 9 0 t 9 0 M -9 3 q 5 -4 9 0 t 9 0',
  windmill:'M -5 9 L 0 -5 L 5 9 M -3 4 H 3 M 0 -5 l -6 -5 l -2 2 Z M 0 -5 l 5 -6 l 2 2 Z M 0 -5 l 7 3 l -1 3 Z M 0 -5 l -6 4 l -2 -2 Z',
  hill:'M -10 6 L -1 -9 L 10 6 Z M -4 -3 L 0 -1 L 3 -3',
  bog:'M -8 6 H 8 M -5 6 V -5 M 1 6 V -9 M 6 6 V -3 M -8 -2 L -5 2 M 4 -5 L 1 0',
  stairs:'M -9 8 H -4 V 3 H 1 V -2 H 6 V -7 H 10',
  arch:'M -8 8 V -1 a 8 8 0 0 1 16 0 V 8 M -5 8 V -1 a 5 5 0 0 1 10 0 V 8',
  house:'M -10 -1 L 0 -9 L 10 -1 M -7 -2 V 8 H 7 V -2 M -2 8 V 2 H 2 V 8',
  satellite:'M -5 -6 Q 0 -9 5 -6 V 6 Q 0 9 -5 6 Z M -5 -5 Q 0 -2 5 -5 M -5 4 Q 0 7 5 4 M 0 -8 V -12 M 5 -2 L 10 -6 M -5 0 L -10 4',
  orbit:'M -10 4 C -12 -2 8 -9 10 -4 C 13 2 -8 9 -10 4 M -3 -2 a 4 4 0 1 0 6 4 a 4 4 0 1 0 -6 -4',
  place:'M 0 -7 L 7 0 L 0 7 L -7 0 Z',
};
export function mapIconPath(kind){return icons[kind]||icons.place;}
