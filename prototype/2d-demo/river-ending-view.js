const phases=['bank','boat','aboard','menu'];

// Paragraphs in a scene keep their original order, including in bilingual mode.
function localized(text,language) {
  return text.split(/\n+/).filter(Boolean).filter(line=>language==='both' ||
    (language==='cn')===/[\u3400-\u9fff]/.test(line)).join('\n\n');
}

export function createRiverEndingView(host,{onRestore,onRestart,onQuit}){
  const find=id=>host.querySelector('#ending-'+id);
  const next=find('next'),restore=find('restore'),restart=find('restart'),quit=find('quit');
  const text=find('text'),error=find('error');
  let result=null,index=-1,elapsed=0;
  let language='cn',binding='F';
  const menu=()=>index===3;

  function paint(){
    const buttons=[restore,restart,quit];
    for(const button of buttons)button.hidden=!menu();
    next.hidden=menu();
    next.textContent=language==='en'?'→ '+binding:'继续 '+binding;
    restore.textContent=localized('RESTORE\n读取存档',language);
    restart.textContent=localized('RESTART\n重新开始',language);
    quit.textContent=localized('QUIT\n返回标题',language);
    find('title').textContent=localized('The River\n河流',language).replace(/\n+/g,' · ');
    text.textContent=localized(menu()?result.summary:result.pages[index],language);
    text.scrollTop=0;
    text.tabIndex=text.scrollHeight>text.clientHeight?0:-1;
    (menu()?(restore.disabled?restart:restore):next).focus({preventScroll:true});
  }

  function advance(){
    if(!result || menu())return;
    index++;
    // The menu keeps the final seated tableau even for a fast reader.
    elapsed=menu()?60:0;
    host.hidden=false;
    for(const sibling of host.parentElement.children)if(sibling!==host)sibling.inert=true;
    paint();
  }
  function close(){
    if(!host.hidden){
      for(const sibling of host.parentElement.children)if(sibling!==host)sibling.inert=false;
    }
    host.hidden=true;result=null;index=-1;elapsed=0;error.hidden=true;error.textContent='';
  }
  next.onclick=advance;
  restore.onclick=onRestore;
  restart.onclick=onRestart;
  quit.onclick=onQuit;
  return {
    get pending(){return !!result && index===-1;},
    get active(){return !!result;},
    get open(){return index>=0;},
    get artPhase(){return Math.min(index,2);},
    get elapsed(){return elapsed;},
    prepare(data,options){
      close();result=data;language=options.language;binding=options.binding;restore.disabled=!options.canRestore;
    },
    advance,close,
    tick(dt){if(index>=0 && !menu())elapsed+=dt;},
    showError(message){error.hidden=false;error.textContent=message;},
    snapshot(){return index<0?null:{phase:phases[index],score:result.score,turns:result.turns,rank:result.rank};},
    key(event,key,interact){
      if(key==='Tab'){
        const choices=[text,next,restore,restart,quit].filter(el=>el.tabIndex>=0 && !el.disabled && !el.hidden);
        const focus=host.ownerDocument.activeElement;
        if(event.shiftKey && focus===choices[0]){event.preventDefault();choices.at(-1).focus();}
        if(!event.shiftKey && focus===choices.at(-1)){event.preventDefault();choices[0].focus();}
        return;
      }
      if(event.target===text && ['ArrowDown','ArrowUp','PageDown','PageUp','Home','End'].includes(key))return;
      if(menu() && (key==='Enter'||key===' ') && host.contains(event.target))return;
      event.preventDefault();
      if(!event.repeat && key===interact && !menu())advance();
      else if(!event.repeat && !menu() && (key==='Enter'||key===' ') && event.target===next)advance();
    },
  };
}
