const intersects = (a, b, padding = 0) => a.x < b.x + b.width + padding && a.x + a.width > b.x - padding && a.y < b.y + b.height + padding && a.y + a.height > b.y - padding;
export function placeEdgeLabels(nodes, edges, sizes = {}, orientation = 'horizontal') {
  const vertical = orientation === 'vertical';
  const byId = new Map(nodes.map(n => [n.id, n]));
  const obstacles = nodes.map(n => ({ ...n.position, width:n.width || 300, height:n.height || 450 }));
  const result = {};
  for (const edge of [...edges].sort((a,b)=>a.id.localeCompare(b.id))) {
    const source = byId.get(edge.source), target = byId.get(edge.target);
    if (!source || !target) continue;
    const width = sizes[edge.id]?.width || 260, height = sizes[edge.id]?.height || 180;
    const left = source.position.x + (source.width || 300);
    const right = target.position.x;
    // Keep long-edge labels in the last corridor, away from intermediate columns.
    const anchorX = sizes[edge.id]?.anchorX, anchorY = sizes[edge.id]?.anchorY;
    const x0 = anchorX !== undefined ? anchorX - width / 2
      : vertical ? (source.position.x + target.position.x + (source.width || 300)) / 2 - width / 2 : (left + right - width) / 2;
    const y0 = anchorY !== undefined ? anchorY - height / 2
      : vertical ? (source.position.y + (source.height || 450) + target.position.y - height) / 2 : (source.position.y + target.position.y) / 2 + 100 - height / 2;
    let box;
    for (let i=0;i<400;i++) {
      const offset = Math.ceil(i/2) * 32 * (i%2 ? -1 : 1);
      // Slide across the lane axis: vertically in a horizontal map, horizontally in a vertical one.
      const candidate = vertical ? {x:x0+offset,y:y0,width,height} : {x:x0,y:y0+offset,width,height};
      if (!obstacles.some(o=>intersects(candidate,o,28))) { box=candidate; break; }
    }
    if (!box) box = vertical
      ? { x:Math.max(...obstacles.map(o=>o.x+o.width))+48, y:y0, width, height }
      : { x:x0, y:Math.min(0,...obstacles.map(o=>o.y))-height-48, width, height };
    result[edge.id] = box;
    obstacles.push(box);
  }
  return result;
}

// Orthogonal visibility graph: routes may touch the padded boundary, never cross a node.
export function routeSegment(start, end, obstacles) {
  const xs = [...new Set([start.x,end.x,...obstacles.flatMap(o=>[o.x,o.x+o.width])])].sort((a,b)=>a-b);
  const ys = [...new Set([start.y,end.y,...obstacles.flatMap(o=>[o.y,o.y+o.height])])].sort((a,b)=>a-b);
  const inside = p => obstacles.some(o=>p.x>o.x+.1 && p.x<o.x+o.width-.1 && p.y>o.y+.1 && p.y<o.y+o.height-.1);
  const clear = (a,b) => !obstacles.some(o=>a.x===b.x ? a.x>o.x+.1 && a.x<o.x+o.width-.1 && Math.max(a.y,b.y)>o.y+.1 && Math.min(a.y,b.y)<o.y+o.height-.1 : a.y>o.y+.1 && a.y<o.y+o.height-.1 && Math.max(a.x,b.x)>o.x+.1 && Math.min(a.x,b.x)<o.x+o.width-.1);
  const points = []; const index = new Map();
  xs.forEach((x,xi)=>ys.forEach((y,yi)=>{if(!inside({x,y})) {index.set(`${xi},${yi}`,points.length);points.push({x,y,xi,yi});}}));
  const from=index.get(`${xs.indexOf(start.x)},${ys.indexOf(start.y)}`), to=index.get(`${xs.indexOf(end.x)},${ys.indexOf(end.y)}`);
  if(from===undefined || to===undefined) return [start,end];
  const costs=new Map([[from,0]]), previous=new Map(), open=new Set([from]);
  while(open.size) {
    let current; let best=Infinity;
    for(const id of open) { const p=points[id]; const score=costs.get(id)+Math.abs(p.x-end.x)+Math.abs(p.y-end.y);if(score<best){best=score;current=id;} }
    if(current===to) break;
    open.delete(current);const a=points[current];
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const next=index.get(`${a.xi+dx},${a.yi+dy}`);if(next===undefined) continue;
      const b=points[next];if(!clear(a,b)) continue;
      const cost=costs.get(current)+Math.abs(a.x-b.x)+Math.abs(a.y-b.y)+1;
      if(cost<(costs.get(next)??Infinity)){costs.set(next,cost);previous.set(next,current);open.add(next);}
    }
  }
  if(!costs.has(to)) return [start,end];
  const path=[];let current=to;while(current!==undefined){path.unshift(points[current]);current=previous.get(current);}return path;
}
export function routedEdgePath(source, target, box, nodes) {
  const obstacles=nodes.map(n=>({x:n.position.x-18,y:n.position.y-18,width:(n.width||300)+36,height:(n.height||450)+36}));
  // The short port stubs leave the source/target padding before obstacle routing.
  const start={x:source.x+22,y:source.y}, end={x:target.x-22,y:target.y};
  const left={x:box.x-12,y:box.y+box.height/2}, right={x:box.x+box.width+12,y:left.y};
  const points=[source,...routeSegment(start,left,obstacles),right,...routeSegment(right,end,obstacles),target];
  const smoothSegment = (a,b) => {
    if (b.x < a.x) return null;
    const reach = Math.max(0, (b.x-a.x)*0.5);
    const c1={x:a.x+reach,y:a.y}, c2={x:b.x-reach,y:b.y};
    for(let i=1;i<100;i++) {
      const t=i/100,u=1-t;
      const x=u*u*u*a.x+3*u*u*t*c1.x+3*u*t*t*c2.x+t*t*t*b.x;
      const y=u*u*u*a.y+3*u*u*t*c1.y+3*u*t*t*c2.y+t*t*t*b.y;
      if(obstacles.some(o=>x>o.x && x<o.x+o.width && y>o.y && y<o.y+o.height)) return null;
    }
    return `C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${b.x} ${b.y}`;
  };
  const first=smoothSegment(start,left), last=smoothSegment(right,end);
  if(first && last) return `M ${source.x} ${source.y} L ${start.x} ${start.y} ${first} L ${right.x} ${right.y} ${last} L ${target.x} ${target.y}`;
  return roundedPath(points);

}

// Round only inside the reserved 18px clearance, so bends remain outside nodes.
export function roundedPath(points) {
  const clean=[];
  for(const point of points) {
    const prev=clean.at(-1);
    if(prev && prev.x===point.x && prev.y===point.y) continue;
    const before=clean.at(-2);
    if(before && ((before.x===prev.x && prev.x===point.x) || (before.y===prev.y && prev.y===point.y))) clean.pop();
    clean.push(point);
  }
  if(!clean.length) return '';
  let path=`M ${clean[0].x} ${clean[0].y}`;
  for(let i=1;i<clean.length-1;i++) {
    const a=clean[i-1],b=clean[i],c=clean[i+1];
    const ab=Math.hypot(b.x-a.x,b.y-a.y),bc=Math.hypot(c.x-b.x,c.y-b.y);
    const r=Math.min(16,ab/2,bc/2);
    const enter={x:b.x+(a.x-b.x)*r/ab,y:b.y+(a.y-b.y)*r/ab};
    const leave={x:b.x+(c.x-b.x)*r/bc,y:b.y+(c.y-b.y)*r/bc};
    path+=` L ${enter.x} ${enter.y} Q ${b.x} ${b.y} ${leave.x} ${leave.y}`;
  }
  const end=clean.at(-1);
  return `${path} L ${end.x} ${end.y}`;
}
