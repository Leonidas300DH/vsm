import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {IDBFactory} from 'fake-indexeddb';
import {saveFile,getFile,deleteFile} from '../src/utils/db.js';import {makePortable,importEmbedded} from '../src/services/portable.js';import {migrateProject,activeScenario} from '../src/services/project.js';
globalThis.indexedDB=new IDBFactory();
globalThis.FileReader=class{async readAsDataURL(blob){try{this.result=`data:${blob.type||'application/octet-stream'};base64,${Buffer.from(await blob.arrayBuffer()).toString('base64')}`;this.onload();}catch(e){this.error=e;this.onerror();}}};
test('portable VSM round trip includes documents, logos, metadata and named versions',async()=>{const p=migrateProject(JSON.parse(fs.readFileSync(new URL('./fixtures/custom-logo.vsm',import.meta.url))));const s=activeScenario(p);s.nodes[1].data.attachments=[{id:'doc',name:'preuve.txt'},{id:'missing',name:'absent.txt'}];await saveFile({id:'doc',name:'preuve.txt',content:new Blob(['Document recette'],{type:'text/plain'})});const exported=await makePortable(p,[{id:'v',name:'Nom',project:structuredClone(p)}]);assert.equal(exported.embeddedFiles.length,1);assert.equal(exported.missingFiles.length,1);assert.equal(exported.namedVersions.length,1);const imported=migrateProject(JSON.parse(JSON.stringify(exported)));assert.deepEqual(imported.extraBusinessField,{preserve:true});assert.equal(activeScenario(imported).tools[0].logo,s.tools[0].logo);await deleteFile('doc');assert.equal(await getFile('doc'),undefined);await importEmbedded(imported);assert.equal(await(await getFile('doc')).content.text(),'Document recette');});

test('importing an attachment ID collision never overwrites an older project or version',async()=>{
 await saveFile({id:'collision',content:new Blob(['Original'],{type:'text/plain'})});
 const project={scenarios:[{nodes:[{data:{attachments:[{id:'collision'}]}}]}],embeddedFiles:[{id:'collision',content:'data:text/plain;base64,TmV3'}]};
 await importEmbedded(project);
 assert.equal(await(await getFile('collision')).content.text(),'Original');
 const id=project.scenarios[0].nodes[0].data.attachments[0].id;
 assert.notEqual(id,'collision');assert.equal(await(await getFile(id)).content.text(),'New');
});
