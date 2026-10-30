// Static artwork geometry is shared. Dynamic feet (people, doors, prams) form
// a small changing signature; repeated frames need not allocate a new mesh.
export function createNavigationSceneCache(){
  let prior=null,shape=null,key=null,mesh=null;
  return (scene,bodies=[])=>{
    const next=JSON.stringify([scene.obstacles||[],bodies]);
    const refs=[scene.walkablePolygons,scene.blockedPolygons,scene.footprint,scene.contactOffsets,scene.pathResolution];
    if(prior!==scene||next!==key||refs.some((value,index)=>value!==shape?.[index])){
      prior=scene;key=next;shape=refs;
      mesh={...scene,obstacles:[...(scene.obstacles||[]),...bodies]};
    }
    return mesh;
  };
}
