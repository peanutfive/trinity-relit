// CLOCKER adds 15s; WAIT requests four cycles. The lake clock freezes but
// I-LONDON-HOLE continues its seven-event countdown (original source + DAT).
export const CLOCK_START=15*3600+30*60;
export const CLOCK_FREEZE=29*60+45;
const lake=s=>['long_water','wading'].includes(s.room);
export function prologueClock(s){
  const frozen=s.hasFlag('prologue_time_frozen')||(s.chapter==='prologue'&&lake(s));
  const elapsed=s.hasFlag('prologue_clock_initialized')?s.cnt('prologue_seconds')
    :frozen?CLOCK_FREEZE:Math.max(0,Math.min(CLOCK_FREEZE,(s.timer?.id==='doomsday'?80-s.timer.remaining:s.turns||0)*15));
  return {seconds:CLOCK_START+elapsed,elapsed,frozen,phase:s.cnt('long_water_phase'),
    anomalous:s.chapter==='wabe',estimated:s.hasFlag('prologue_clock_estimated')};
}
export function watchDescription(s){
  if(s.chapter==='wabe')return "Your wristwatch's digits are flashing randomly.\n\n你的手表数字正在无规律地闪烁。";
  const clock=prologueClock(s),hours=Math.floor(clock.seconds/3600)%24,
    minutes=Math.floor(clock.seconds/60)%60,seconds=clock.seconds%60;
  const time=`${hours%12||12}:${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;
  let text=`Your wristwatch says it's ${time} ${hours>=12?'pm':'am'}.\n\n你的手表显示现在是${hours>=12?'下午':'上午'}${time}。`;
  if(clock.frozen)text+='\n\n(That\'s odd. The "seconds" display has stopped working.)\n\n（奇怪，“秒数”显示停止跳动了。）';
  return text;
}
function remaining(s){return s.hasFlag('prologue_time_frozen')?8-s.cnt('long_water_phase'):120-Math.floor(s.cnt('prologue_seconds')/15);}
export function ensurePrologueClock(s,handler){
  if(s.chapter!=='prologue'||s.hasFlag('prologue_done'))return;
  if(!s.hasFlag('prologue_clock_initialized')){
    const clock=prologueClock(s);s.setCnt('prologue_seconds',clock.elapsed);s.setFlag('prologue_clock_initialized');
    if(s.turns)s.setFlag('prologue_clock_estimated');
    if(clock.frozen){s.setFlag('prologue_time_frozen');s.setFlag('at_long_water');s.setCnt('long_water_phase',s.hasFlag('white_door_visible')?3:s.hasFlag('missile_visible')?2:0);}
  }
  if(!s.timer||s.timer.id==='doomsday')s.startTimer(Math.max(1,remaining(s)),'doomsday',handler);
}
export function freezeLongWater(s,handler){
  if(s.hasFlag('prologue_time_frozen'))return;
  s.setFlag('prologue_clock_initialized');s.setFlag('prologue_time_frozen');s.setFlag('at_long_water');
  s.setCnt('prologue_seconds',CLOCK_FREEZE);s.setCnt('long_water_phase',0);s.setCnt('long_water_arrival_turn',s.turns);
  // A newly queued event does not run in the crash's own command.
  s.startTimer(9,'doomsday',handler);
}
export function freePrologueAction(s){s.turns=Math.max(0,s.turns-1);s.setFlag('prologue_clock_skip');}
export function settlePrologueClock(s,eng,handler,{raid,lakeEvent,extraTurn}){
  if(s.chapter!=='prologue'||s.hasFlag('prologue_done')){s.clearFlag('prologue_time_frozen');s.clearTimer();return;}
  if(s.hasFlag('prologue_clock_skip')){s.clearFlag('prologue_clock_skip');ensurePrologueClock(s,handler);return;}
  const steps=s.cnt('prologue_clock_steps')||1;s.setCnt('prologue_clock_steps',0);
  if(s.hasFlag('prologue_time_frozen')){
    if(s.cnt('long_water_arrival_turn')!==s.turns)lakeEvent(s,eng);
  }else for(let i=0;i<steps&&!s.dead;i++){
    if(i)extraTurn?.(s,eng);
    const interrupted=raid(s,eng)||s.hasFlag('prologue_clock_event');
    s.clearFlag('prologue_clock_event');
    if(!s.dead)s.setCnt('prologue_seconds',s.cnt('prologue_seconds')+15);
    if(interrupted)break;
  }
  if(!s.dead)ensurePrologueClock(s,handler);
}
