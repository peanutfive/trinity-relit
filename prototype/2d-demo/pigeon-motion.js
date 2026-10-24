export const PIGEON_FLOCK=Object.freeze([[-18,-9],[-6,1],[9,-7],[18,7],[-17,12]].map(Object.freeze));
const ease=t=>t*t*(3-2*t);
export function pigeonGroundPose(time,index=0,feeding=false){
 const t=((time+index*1.731)%7.8+7.8)%7.8,dir=index%2?-1:1;
 let step=0,frame=0;
 if(t>=1.6&&t<3){step=ease((t-1.6)/1.4);frame=1+Math.floor(time*6+index)%2;}
 else if(t>=3&&t<3.4){step=1;frame=3;}
 else if(t>=3.4&&t<4.6){step=1;frame=Math.floor(time*5+index)%2?4:3;}
 else if(t>=4.6&&t<5.7){step=1;frame=0;}
 else if(t>=5.7){step=1-ease((t-5.7)/2.1);frame=1+Math.floor(time*6+index)%2;}
 if(feeding&&t>2.5&&t<5.8)frame=Math.floor(time*5+index)%3===0?3:4;
 return {frame,x:dir*step*3,y:Math.abs(Math.sin(time*5+index))*(frame===1||frame===2?-.2:0),flip:dir<0};
}
