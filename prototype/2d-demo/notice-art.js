const image=new Image();image.src=new URL('./assets/notice-v2.png',import.meta.url).href;
export function renderNotice(ctx,object){
  if(object.id!=='lancaster_walk:notice')return false;
  if(!image.complete||!image.naturalWidth)return false;
  ctx.save();ctx.fillStyle='#17251c38';ctx.beginPath();ctx.ellipse(object.x+2,object.y+.5,5,1.5,-.12,0,Math.PI*2);ctx.fill();
  ctx.imageSmoothingEnabled=true;
  ctx.drawImage(image,185,3,650,1510,object.x-8.2,object.y-34,14.6,34);ctx.restore();return true;
}
export const noticeArtStatus=()=>image.complete&&image.naturalWidth?'loaded':'loading';
