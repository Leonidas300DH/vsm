import test from 'node:test';
import assert from 'node:assert/strict';
import { placeEdgeLabels, routeSegment } from '../src/utils/edgeRouting.js';
const overlap=(a,b)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
test('large labels avoid tightly packed nodes and one another',()=>{
 const nodes=[{id:'a',position:{x:0,y:0},width:300,height:420},{id:'b',position:{x:420,y:0},width:300,height:420}];
 const edges=[{id:'one',source:'a',target:'b'},{id:'two',source:'a',target:'b'}];
 const boxes=Object.values(placeEdgeLabels(nodes,edges,{'one':{width:260,height:260},'two':{width:260,height:310}}));
 for(const box of boxes) for(const n of nodes) assert.equal(overlap(box,{...n.position,width:n.width,height:n.height}),false);
 assert.equal(overlap(...boxes),false);
});
test('routes detour around intervening node rectangles',()=>{
 const obstacle={x:100,y:-50,width:100,height:100};
 const points=routeSegment({x:0,y:0},{x:300,y:0},[obstacle]);
 assert.ok(points.some(p=>Math.abs(p.y)>=50));
 for(let i=1;i<points.length;i++) {
  const a=points[i-1],b=points[i];
  assert.ok(a.x===b.x||a.y===b.y);
  const middle={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
  assert.ok(!(middle.x>100&&middle.x<200&&middle.y>-50&&middle.y<50));
 }
});
