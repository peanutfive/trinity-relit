// Original painted explorer atlas. Logical feet remain the physics anchor.
const atlas=typeof Image==='function'?new Image():null;
if(atlas)atlas.src=new URL('./assets/hero-sprites.png',import.meta.url).href;
const rows={down:0,up:1,left:2,right:3};
const feet=[
  [[145.4,251],[132.6,252],[122.4,252],[120.4,252],[111.4,252],[121.9,243]],
  [[146.1,251],[145.1,251],[136.6,251],[125.1,251],[135.3,252],[94.7,237]],
  [[135.2,245],[113.8,239],[100.8,238],[119.1,237],[112.5,243],[102.7,234]],
  [[141.5,227],[110.1,224],[146.2,226],[138.9,222],[138.8,230],[108.2,211]],
];
const idleHeight=[225,228,230,219];
export function paintHeroSprite(c,facing,phase,pose,animation){
  if(!atlas?.complete||!atlas.naturalWidth)return false;
  const row=rows[facing]??0;
  let column=0;
  if(pose.pickup>.35)column=5;
  else if(pose.inspect>.35)column=4;
  else if(animation.moving&&animation.blend>.2)column=[1,2,3,2][Math.floor(((phase%(Math.PI*2)+Math.PI*2)%(Math.PI*2))/(Math.PI/2))];
  const [fx,fy]=feet[row][column],scale=35/idleHeight[row];
  // The third generated row's passing pose faces left; its other poses face
  // right and are mirrored here, preserving a consistent gameplay direction.
  const flip=facing==='left'&&column!==2;
  c.save();c.imageSmoothingEnabled=true;if(flip)c.scale(-1,1);
  c.scale(1,1+pose.breathe/35);
  c.drawImage(atlas,column*256,row*256,256,256,-fx*scale,-fy*scale,256*scale,256*scale);
  c.restore();return true;
}
export function heroArtStatus(){return atlas?.complete&&atlas.naturalWidth?'loaded':'loading';}
