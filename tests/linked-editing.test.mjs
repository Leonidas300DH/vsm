import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { IDBFactory } from 'fake-indexeddb';
import { createStore } from 'zustand/vanilla';
import { installWorkspace } from '../src/services/workspace.js';
import { migrateProject, duplicateScenario, signature } from '../src/services/project.js';
import { linkedSession, prepareLinkedEdit } from '../src/services/linkedEditing.js';
const simple = JSON.parse(fs.readFileSync(new URL('./fixtures/simple.vsm', import.meta.url)));
function fixture() {
  let p = migrateProject(simple);
  p.scenarios[0].name = 'Current State';
  p.scenarios[0].nodes[0].data.volumeItems.push({id:'b',name:'Entreprises',value:5});
  p.scenarios[0].nodes[1].data.cycleTimes.b = 8;
  p.scenarios[0].nodes[1].data.unknownBusiness = { nested:['preserved'] };
  p.scenarios[0].tools = [{id:'excel',name:'Excel',logo:'data:image/png;base64,original'}];
  p = duplicateScenario(p,'Future State',p.scenarios[0]);
  p = duplicateScenario(p,'Today',p.scenarios[0]);
  const [master,a,b] = p.scenarios.map(s=>s.id);
  return {p,master,a,b,session:{...linkedSession(p,{masterId:master,childIds:[a,b],linkedIds:[a,b]}),active:true}};
}
const edit = (updates,id='p',kind='nodes') => ({type:'patch',kind,id,updates:{data:updates}});
const node = (p, sid, id='p')=>p.scenarios.find(s=>s.id===sid).nodes.find(n=>n.id===id);
test('linked edit uses absolute changed fields and preserves child differences, IDs and unknown data',()=>{
  const {p,master,a,b,session}=fixture();
  node(p,a).data.cycleTimes={a:20,b:99}; node(p,a).data.wait_time=200;
  const {project:next,report}=prepareLinkedEdit(p,session,master,edit({cycleTimes:{a:3,b:8}}));
  assert.equal(report.length,3);
  for(const id of [master,a,b]) assert.equal(node(next,id).data.cycleTimes.a,3);
  assert.equal(node(next,a).data.cycleTimes.b,99);
  assert.equal(node(next,a).data.wait_time,200);
  assert.deepEqual(node(next,a).data.unknownBusiness,{nested:['preserved']});
  assert.equal(node(p,master).data.cycleTimes.a,4);
});
test('unlinked children and paused sessions remain independent',()=>{
  const {p,master,a,b,session}=fixture();
  const next=prepareLinkedEdit(p,{...session,linkedIds:[a]},master,edit({label:'Renamed'})).project;
  assert.equal(node(next,a).data.label,'Renamed'); assert.equal(node(next,b).data.label,'Vérifier');
  const paused=prepareLinkedEdit(p,{...session,active:false},master,edit({label:'Local'})).project;
  assert.equal(node(paused,master).data.label,'Local'); assert.equal(node(paused,a).data.label,'Vérifier');
});
test('child edits never travel upstream or sideways',()=>{
  const {p,master,a,b,session}=fixture();
  const next=prepareLinkedEdit(p,session,a,edit({label:'Local child'})).project;
  assert.equal(node(next,a).data.label,'Local child'); assert.equal(node(next,master).data.label,'Vérifier'); assert.equal(node(next,b).data.label,'Vérifier');
});
test('missing counterpart is reported, not recreated, and renamed counterparts still match',()=>{
  const {p,master,a,b,session}=fixture();
  p.scenarios.find(s=>s.id===b).nodes=[]; p.scenarios.find(s=>s.id===b).edges=[];
  node(p,a).data.label='Other name';
  const result=prepareLinkedEdit(p,session,master,edit({cycleTimes:{a:2}}));
  assert.equal(result.missing.length,1); assert.equal(result.report.length,2); assert.equal(node(result.project,a).data.cycleTimes.a,2); assert.equal(result.project.scenarios[2].nodes.length,0);
});
test('invalid value or absent category rejects the entire transaction',()=>{
  const {p,master,a,session}=fixture(), before=signature(p);
  assert.throws(()=>prepareLinkedEdit(p,session,master,edit({cycleTimes:{a:-1}})),/invalide/);
  assert.throws(()=>prepareLinkedEdit(p,session,master,edit({percentage:101},'e1','edges')),/100/);
  node(p,a,'in').data.volumeItems=[];
  assert.throws(()=>prepareLinkedEdit(p,session,master,edit({cycleTimes:{a:2}})),/catégorie/);
  assert.equal(node(p,master).data.cycleTimes.a,4); assert.ok(before);
});
test('resource attachments copy missing definitions and logos without sharing references',()=>{
  const {p,master,a,session}=fixture(); p.scenarios[1].tools=[];
  const result=prepareLinkedEdit(p,session,master,edit({toolsUsed:['excel']}));
  assert.equal(result.project.scenarios[1].tools[0].logo,'data:image/png;base64,original');
  result.project.scenarios[1].tools[0].name='Child'; assert.equal(result.project.scenarios[0].tools[0].name,'Excel');
  assert.deepEqual(node(result.project,a).data.toolsUsed,['excel']);
});
test('library fields propagate without replacing untouched child fields',()=>{
  const {p,master,session}=fixture(); p.scenarios[1].tools[0].description='Child annotation';
  const next=prepareLinkedEdit(p,session,master,{type:'resource',kind:'tools',entry:{...p.scenarios[0].tools[0],name:'Excel revised'}}).project;
  assert.equal(next.scenarios[1].tools[0].name,'Excel revised'); assert.equal(next.scenarios[1].tools[0].description,'Child annotation');
});
test('edge routing and category wait changes are scoped and recalculated per scenario',()=>{
  const {p,master,a,session}=fixture(); node(p,a,'in').data.volumeItems[0].value=20;
  const r=prepareLinkedEdit(p,session,master,edit({cycleTimes:{a:3}})).project;
  assert.notEqual(node(r,master).data.process_time_total,node(r,a).data.process_time_total);
  const edges=prepareLinkedEdit(r,session,master,edit({itemData:{a:{wait:60}}},'e1','edges')).project;
  assert.equal(edges.scenarios[1].edges[0].data.itemData.a.wait,60);
});
test('remove preserves comments and deletes each target incident connections',()=>{
  const {p,master,a,session}=fixture(); p.scenarios[1].comments=[{id:'comment',targetId:'p',text:'Review'}];
  const next=prepareLinkedEdit(p,session,master,{type:'remove',kind:'nodes',id:'p'}).project;
  for(const s of next.scenarios){assert.equal(s.nodes.length,2);assert.equal(s.edges.length,0);}
  assert.equal(next.scenarios.find(s=>s.id===a).comments.length,1);
});
test('structural inserts preserve IDs and reject collisions or orphan connections atomically',()=>{
  const {p,master,a,session}=fixture();
  const command={type:'insert',nodes:[{id:'new',type:'process',position:{x:2500,y:0},data:{label:'New'}}],edges:[{id:'newedge',source:'out',target:'new',data:{}}]};
  const next=prepareLinkedEdit(p,session,master,command).project;
  assert.ok(node(next,a,'new')); assert.equal(next.scenarios[1].edges.at(-1).id,'newedge');
  assert.throws(()=>prepareLinkedEdit(p,session,master,{...command,nodes:[{...command.nodes[0],position:{x:700,y:0}}]}),/chevauchement/);
  assert.throws(()=>prepareLinkedEdit(p,session,master,{type:'insert',edges:[{id:'orphan',source:'missing',target:'p'}]}),/absente/);
  assert.equal(p.scenarios[0].nodes.length,3);
});
test('positions remain local by default; linked moves reject locks and overlaps',()=>{
  const {p,master,a,session}=fixture();
  const move={type:'move',id:'out',position:{x:2000,y:-100}};
  const local=prepareLinkedEdit(p,session,master,move).project;
  assert.equal(node(local,a,'out').position.x,1400);
  const linked=prepareLinkedEdit(p,{...session,positions:true},master,move).project;
  assert.equal(node(linked,a,'out').position.x,2000);
  node(p,a,'out').data.positionLocked=true;
  assert.throws(()=>prepareLinkedEdit(p,{...session,positions:true},master,move),/verrouillée/);
  assert.throws(()=>prepareLinkedEdit(p,session,master,{...move,position:{x:700,y:0}}),/chevauchement/);
});
test('realignment replaces common fields only and preserves child-only branches and metadata',()=>{
  const {p,master,a,session}=fixture(); node(p,a).data.label='Divergence';
  p.scenarios[1].nodes.push({id:'extra',type:'process',position:{x:3000,y:0},data:{label:'Child only'}});
  p.scenarios[1].comments=[{id:'c',text:'Keep'}];
  const next=prepareLinkedEdit(p,session,master,{type:'realign',childIds:[a]}).project;
  assert.equal(node(next,a).data.label,'Vérifier'); assert.ok(node(next,a,'extra')); assert.equal(next.scenarios[1].comments[0].text,'Keep');
});
async function workspace() {
  const {p,master,a,b}=fixture(), factory=new IDBFactory();
  const create=()=>createStore(()=>({nodes:[],edges:[],tools:[],actors:[],knowledge:[],projectTitle:'Test'}));
  const store=create(), controller=installWorkspace(store,{factory,listen:false}); await controller.initialized;
  await store.getState().replaceWorkspace(p); store.getState().beginLinkedEditing(); store.getState().configureLinkedEditing({masterId:master,childIds:[a,b],linkedIds:[a,b],active:true});
  return {store,controller,factory,create,master,a,b};
}
test('one undo/redo restores all linked targets together and preserves unlink state',async()=>{
  const {store,controller,master,a,b}=await workspace();
  try {
    store.getState().applyLinkedEdit(master,edit({cycleTimes:{a:2}}));
    for(const id of [master,a,b])assert.equal(node(store.getState().getWorkspaceProject(),id).data.cycleTimes.a,2);
    store.getState().configureLinkedEditing({linkedIds:[a]});
    store.getState().undoBusiness();
    for(const id of [master,a,b])assert.equal(node(store.getState().getWorkspaceProject(),id).data.cycleTimes.a,4);
    assert.deepEqual(store.getState().linkedEditSession.linkedIds,[a]);
    assert.equal(store.getState().getWorkspaceProject().linkedEditing.active,false);
    store.getState().redoBusiness();
    for(const id of [master,a,b])assert.equal(node(store.getState().getWorkspaceProject(),id).data.cycleTimes.a,2);
    store.getState().applyLinkedEdit(master,edit({cycleTimes:{a:1}}));
    assert.equal(node(store.getState().getWorkspaceProject(),b).data.cycleTimes.a,2);
  } finally {controller.close();}
});
test('direct child command detaches it defensively and grouped typing is one undo',async()=>{
  const {store,controller,master,a,b}=await workspace();
  try {
    store.getState().applyLinkedEdit(a,edit({label:'L'}),{group:'typing'});
    store.getState().applyLinkedEdit(a,edit({label:'Local'}),{group:'typing'});
    assert.deepEqual(store.getState().linkedEditSession.linkedIds,[b]);
    store.getState().undoBusiness(); assert.equal(node(store.getState().getWorkspaceProject(),a).data.label,'Vérifier');
    store.getState().redoBusiness(); assert.equal(node(store.getState().getWorkspaceProject(),a).data.label,'Local');
    store.getState().applyLinkedEdit(master,edit({label:'Parent'}));
    assert.equal(node(store.getState().getWorkspaceProject(),a).data.label,'Local');
    store.getState().configureLinkedEditing({linkedIds:[a,b]});
    assert.equal(node(store.getState().getWorkspaceProject(),a).data.label,'Local');
    store.getState().applyLinkedEdit(master,edit({description:'Next field'}));
    assert.equal(node(store.getState().getWorkspaceProject(),a).data.label,'Local');
  } finally {controller.close();}
});
test('structural preview is enforced and failed validation produces no history or partial edits',async()=>{
  const {store,controller,master}=await workspace();
  try {
    const before=signature(store.getState().getWorkspaceProject());
    assert.throws(()=>store.getState().applyLinkedEdit(master,{type:'remove',kind:'nodes',id:'p'}),/aperçu/);
    assert.throws(()=>store.getState().applyLinkedEdit(master,edit({cycleTimes:{a:-1}})),/invalide/);
    assert.equal(signature(store.getState().getWorkspaceProject()),before);
    assert.equal(store.getState().canUndo,false);
    store.getState().applyLinkedEdit(master,{type:'remove',kind:'nodes',id:'p'},{confirmed:true});
    store.getState().undoBusiness(); assert.ok(node(store.getState().getWorkspaceProject(),master));
  } finally {controller.close();}
});
test('saved configuration and full edits survive reopen/export while propagation restarts paused',async()=>{
  const {store,controller,factory,create,master,a,b}=await workspace();
  try {
    store.getState().configureLinkedEditing({linkedIds:[a],positions:true});
    store.getState().applyLinkedEdit(master,edit({cycleTimes:{a:2}}));
    await store.getState().flushWorkspace();
    const portable=migrateProject(JSON.parse(JSON.stringify(store.getState().getWorkspaceProject())));
    assert.equal(node(portable,a).data.cycleTimes.a,2); assert.equal(node(portable,b).data.cycleTimes.a,4);
    const reopened=create(), second=installWorkspace(reopened,{factory,listen:false}); await second.initialized;
    reopened.getState().beginLinkedEditing();
    assert.equal(reopened.getState().linkedEditSession.active,false);
    assert.deepEqual(reopened.getState().linkedEditSession.childIds,[a,b]);
    assert.deepEqual(reopened.getState().linkedEditSession.linkedIds,[a]);
    assert.equal(reopened.getState().linkedEditSession.positions,true);
    second.close();
  } finally {controller.close();}
});
test('new resource plus attachment is atomic and reversible for all targets',async()=>{
  const {store,controller,master,a,b}=await workspace();
  try {
    store.getState().configureLinkedEditing({linkedIds:[a]});
    store.getState().applyLinkedEdit(master,{type:'resource',kind:'tools',entry:{id:'custom',name:'Custom',logo:'embedded'},nodeId:'p'});
    let p=store.getState().getWorkspaceProject();
    for(const id of [master,a])assert.ok(node(p,id).data.toolsUsed.includes('custom'));
    assert.equal(node(p,b).data.toolsUsed,undefined);
    store.getState().undoBusiness();p=store.getState().getWorkspaceProject();
    for(const id of [master,a]){assert.equal(node(p,id).data.toolsUsed,undefined);assert.ok(!p.scenarios.find(s=>s.id===id).tools.some(r=>r.id==='custom'));}
    store.getState().redoBusiness();assert.ok(node(store.getState().getWorkspaceProject(),a).data.toolsUsed.includes('custom'));
  }finally{controller.close();}
});
test('changing master pauses propagation and normalizes membership without touching baseline',async()=>{
  const {store,controller,master,a,b}=await workspace();
  try {
    store.getState().configureLinkedEditing({masterId:a,childIds:[master,b],linkedIds:[master,b]});
    assert.equal(store.getState().linkedEditSession.active,false);
    assert.equal(store.getState().getWorkspaceProject().actualScenarioId,master);
    store.getState().configureLinkedEditing({active:true});
    store.getState().applyLinkedEdit(a,edit({label:'New master'}));
    for(const id of [master,a,b])assert.equal(node(store.getState().getWorkspaceProject(),id).data.label,'New master');
  }finally{controller.close();}
});
test('unknown values stay unknown in business data and input maps preserve other categories',()=>{
  const {p,master,a,session}=fixture();
  const next=prepareLinkedEdit(p,session,master,edit({cycleTimes:{a:null}})).project;
  assert.equal(node(next,a).data.cycleTimes.a,null);assert.equal(node(next,a).data.cycleTimes.b,8);
});
test('no-op patches do not create history; unknown operations and duplicate IDs are refused',async()=>{
  const {store,controller,master}=await workspace();
  try {
    store.getState().applyLinkedEdit(master,edit({cycleTimes:{a:4}}));assert.equal(store.getState().canUndo,false);
    assert.throws(()=>store.getState().applyLinkedEdit(master,{type:'execute',code:'no'}),/inconnue/);
    assert.throws(()=>store.getState().previewLinkedEdit(master,{type:'insert',nodes:[{id:'p',type:'process',position:{x:4000,y:0},data:{}}]}),/déjà présent/);
  }finally{controller.close();}
});
test('closing linked editing stops its session; unrelated projects do not inherit its targets',async()=>{
  const {store,controller,master,a}=await workspace();
  try {
    store.getState().configureLinkedEditing({linkedIds:[a]});
    store.getState().applyLinkedEdit(master,edit({label:'Saved'}));
    store.getState().endLinkedEditing();
    assert.equal(store.getState().linkedEditSession,null);
    assert.equal(store.getState().getWorkspaceProject().linkedEditing.active,false);
    store.getState().undoBusiness();
    assert.deepEqual(store.getState().getWorkspaceProject().linkedEditing.linkedIds,[a]);
    await store.getState().replaceWorkspace(simple);
    store.getState().beginLinkedEditing();
    assert.equal(store.getState().linkedEditSession.childIds.length,0);
    assert.notEqual(store.getState().linkedEditSession.masterId,master);
  }finally{controller.close();}
});
test('editing a category volume preserves other child categories and per-category metadata',()=>{
  const {p,master,a,session}=fixture();
  const source=node(p,master,'in'), child=node(p,a,'in');
  child.data.volumeItems[0].name='Child category name';child.data.volumeItems[1].value=99;
  child.data.volumeItems.push({id:'child-only',name:'Specific',value:7});
  const volumeItems=structuredClone(source.data.volumeItems);volumeItems[0].value=25;
  const next=prepareLinkedEdit(p,session,master,edit({volumeItems},'in')).project;
  const items=node(next,a,'in').data.volumeItems;
  assert.equal(items[0].value,25);assert.equal(items[0].name,'Child category name');assert.equal(items[1].value,99);assert.equal(items[2].value,7);
});
test('category addition/removal propagates by ID and missing edited categories block atomically',()=>{
  const {p,master,a,session}=fixture(), original=node(p,master,'in').data.volumeItems;
  const added=prepareLinkedEdit(p,session,master,edit({volumeItems:[...original,{id:'new',name:'New',value:2}]},'in')).project;
  assert.equal(node(added,a,'in').data.volumeItems.at(-1).id,'new');
  const removed=prepareLinkedEdit(added,session,master,edit({volumeItems:original},'in')).project;
  assert.equal(node(removed,a,'in').data.volumeItems.length,2);
  node(p,a,'in').data.volumeItems=[];
  assert.throws(()=>prepareLinkedEdit(p,session,master,edit({volumeItems:original.map(x=>({...x,value:33}))},'in')),/absente/);
  assert.equal(node(p,master,'in').data.volumeItems[0].value,10);
});
test('realignment respects child position locks and local lock edits do not leak',()=>{
  const {p,master,a,session}=fixture();node(p,a).data.positionLocked=true;node(p,a).position.y=800;
  const next=prepareLinkedEdit(p,session,master,{type:'realign',childIds:[a]}).project;
  assert.equal(node(next,a).data.positionLocked,true);assert.equal(node(next,a).position.y,800);
  assert.throws(()=>prepareLinkedEdit(p,{...session,positions:true},master,{type:'realign',childIds:[a]}),/verrouillée/);
  node(p,master).data.positionLocked=true;
  const unlocked=prepareLinkedEdit(p,session,master,edit({positionLocked:false})).project;
  assert.equal(node(unlocked,a).data.positionLocked,true);assert.equal(node(unlocked,master).data.positionLocked,false);
});
