/* Dijkstra Visualizer - Vanilla JS
   Features: drag/drop nodes, add/delete nodes/edges, generate, run with visual steps,
   pseudocode highlighting, speed control, theme toggle, quiz, export via print.
*/

const canvas = document.getElementById('graphCanvas');
const ctx = canvas.getContext('2d');
const generateBtn = document.getElementById('generateGraph');
const runBtn = document.getElementById('runDijkstra');
const resetBtn = document.getElementById('reset');
const clearEdgesBtn = document.getElementById('clearEdges');
const deleteNodeBtn = document.getElementById('deleteNodeBtn');
const deleteEdgeBtn = document.getElementById('deleteEdgeBtn');
const modeSelect = document.getElementById('modeSelect');
const speedSlider = document.getElementById('speed');
const speedLabel = document.getElementById('speedLabel');
const sourceSelect = document.getElementById('sourceSelect');
const destSelect = document.getElementById('destSelect');
const stepsDiv = document.getElementById('steps');
const pseudocodeToggle = document.getElementById('pseudocodeToggle');
const pseudocodePanel = document.getElementById('pseudocodePanel');
const pseudocodePre = document.getElementById('pseudocode');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const themeToggle = document.getElementById('themeToggle');
const exportBtn = document.getElementById('exportBtn');

const quizBtn = document.getElementById('quizBtn');
const quizModal = document.getElementById('quizModal');
const quizContent = document.getElementById('quizContent');
const submitQuiz = document.getElementById('submitQuiz');
const closeQuiz = document.getElementById('closeQuiz');

let nodes = []; // {id,label,x,y}
let edges = []; // {from,to,weight}
let dragging = null;
let dragOffset = {x:0,y:0};
let canvasRect = canvas.getBoundingClientRect();
let selection = null; // for edge creation
let currentMode = 'move';
let animSpeed = 1.0;
let isRunning = false;

// Helper: resize rect on window resize
window.addEventListener('resize', ()=> canvasRect = canvas.getBoundingClientRect());

// Utility: add step with typing effect
function addStep(text){
  const p = document.createElement('div'); p.className='step';
  stepsDiv.appendChild(p);
  let i=0, s='';
  const speed = 8 / animSpeed;
  function type(){
    s += text[i++] || '';
    p.innerHTML = s;
    if(i<text.length) setTimeout(type, speed);
    else p.scrollIntoView({behavior:'smooth', block:'end'});
  }
  type();
}

// Pseudocode handling
const pseudoLines = pseudocodePre.textContent.trim().split('\n').map(l=>l.trim());
pseudocodePre.innerHTML = '';
pseudoLines.forEach((line, idx)=>{
  const span = document.createElement('div');
  span.className='pseudocode-line';
  span.dataset.idx = idx;
  span.innerText = line;
  pseudocodePre.appendChild(span);
});
function highlightPseudo(lineIdx){
  const spans = [...pseudocodePre.querySelectorAll('.pseudocode-line')];
  spans.forEach(s=> s.classList.remove('active'));
  if(lineIdx !== null && spans[lineIdx]) spans[lineIdx].classList.add('active');
}

// Canvas drawing helpers
function clearCanvas(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  const g = ctx.createLinearGradient(0,0,0,canvas.height);
  g.addColorStop(0,'rgba(255,255,255,0.01)');
  g.addColorStop(1,'transparent');
  ctx.fillStyle = g;
  ctx.fillRect(0,0,canvas.width,canvas.height);
}

function draw(){
  clearCanvas();
  edges.forEach(e=>{
    const a = nodes.find(n=>n.id===e.from);
    const b = nodes.find(n=>n.id===e.to);
    drawEdge(a,b,e.weight);
  });
  if(selection && selection.start){
    const s = selection.start;
    ctx.beginPath(); ctx.moveTo(s.x,s.y); ctx.lineTo(selection.x,selection.y);
    ctx.strokeStyle = 'rgba(88,166,255,0.6)'; ctx.lineWidth = 2; ctx.stroke();
  }
  nodes.forEach(n=> drawNode(n));
}

function drawEdge(a,b,weight,glow=false, highlight=false){
  const midx = (a.x+b.x)/2, midy=(a.y+b.y)/2;
  ctx.beginPath();
  ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y);
  ctx.lineWidth = highlight ? 6 : 2;
  ctx.strokeStyle = highlight ? 'rgba(46,160,67,0.95)' : 'rgba(138,145,150,0.6)';
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(10,12,14,0.8)';
  ctx.fillRect(midx-14, midy-12, 28, 20);
  ctx.fillStyle = '#e6edf3'; ctx.font='12px monospace'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(weight, midx, midy-2);
}

function drawNode(n, color=null){
  ctx.beginPath();
  ctx.arc(n.x, n.y, 24, 0, Math.PI*2);
  ctx.fillStyle = color || (n._visited ? 'rgba(46,160,67,0.9)' : 'rgba(18,22,26,0.95)');
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = n._active ? 'rgba(88,166,255,0.95)' : '#e6edf3';
  ctx.stroke();
  ctx.fillStyle = n._visited ? '#0b0f13' : '#e6edf3';
  ctx.font = '14px Inter, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline='middle';
  ctx.fillText(n.label, n.x, n.y);
  if(n._isSource || n._isDest){
    ctx.beginPath(); ctx.arc(n.x, n.y, 10, 0, Math.PI*2);
    ctx.fillStyle = n._isSource ? 'rgba(88,166,255,0.9)' : 'rgba(46,160,67,0.9)';
    ctx.fill();
  }
}

function getMousePos(evt){
  const rect = canvas.getBoundingClientRect();
  return { x: (evt.clientX - rect.left)*(canvas.width/rect.width), y: (evt.clientY - rect.top)*(canvas.height/rect.height) };
}

function findNodeAt(x,y){
  return nodes.slice().reverse().find(n=> Math.hypot(n.x-x, y-n.y) <= 26 );
}

// ================= Helper: distance from point to line =================
function pointLineDistance(p, a, b){
  const A = p.x - a.x;
  const B = p.y - a.y;
  const C = b.x - a.x;
  const D = b.y - a.y;
  const dot = A*C + B*D;
  const len_sq = C*C + D*D;
  let param = -1;
  if(len_sq !== 0) param = dot / len_sq;
  let xx, yy;
  if(param < 0){ xx = a.x; yy = a.y; }
  else if(param > 1){ xx = b.x; yy = b.y; }
  else { xx = a.x + param*C; yy = a.y + param*D; }
  const dx = p.x - xx;
  const dy = p.y - yy;
  return Math.sqrt(dx*dx + dy*dy);
}

// ================= Node/Edge Management =================
let nodeCounter = 0;
function addNode(x,y,label=null){
  const id = 'n'+(++nodeCounter);
  const lab = label || String.fromCharCode(64 + (nodeCounter));
  nodes.push({id, label:lab, x, y});
  refreshSelects();
  draw();
  return id;
}
function addEdge(from,to,weight){
  if(!from||!to||from===to) return;
  const exists = edges.find(e => (e.from===from && e.to===to) || (e.from===to && e.to===from));
  if(exists) return;
  edges.push({from,to,weight:parseFloat(weight)});
  draw();
}

// refresh source/dest selects
function refreshSelects(){
  [sourceSelect,destSelect].forEach(s=>{
    const prev = s.value;
    s.innerHTML = '';
    nodes.forEach(n=>{
      const opt = document.createElement('option'); opt.value=n.id; opt.textContent=n.label;
      s.appendChild(opt);
    });
    if(prev) s.value = prev;
  });
}

// ================= Preset Graph =================
function generatePreset(){
  nodes = []; edges = []; nodeCounter = 0;
  const preset = [
    {x:120,y:110,label:'A'},
    {x:460,y:90,label:'B'},
    {x:820,y:120,label:'C'},
    {x:250,y:320,label:'D'},
    {x:560,y:330,label:'E'},
    {x:740,y:460,label:'F'}
  ];
  preset.forEach(p => addNode(p.x,p.y,p.label));
  addEdge(nodes[0].id, nodes[3].id, 3);
  addEdge(nodes[0].id, nodes[1].id, 2);
  addEdge(nodes[1].id, nodes[2].id, 4);
  addEdge(nodes[3].id, nodes[4].id, 2);
  addEdge(nodes[4].id, nodes[5].id, 3);
  addEdge(nodes[1].id, nodes[4].id, 5);
  addEdge(nodes[3].id, nodes[2].id, 7);
  refreshSelects();
  addStep('Generated a clean preset graph. Drag nodes to rearrange. Use "Add Edge" to create new weighted edges.');
}
// ================== NEW DELETE FEATURE ==================
deleteNodeBtn.addEventListener('click', () => {
  currentMode = 'deleteNode';
  addStep('Delete mode: Click near a node to remove it along with its edges.');
});
deleteEdgeBtn.addEventListener('click', () => {
  currentMode = 'deleteEdge';
  addStep('Delete mode: Click near an edge to remove it.');
});
// ========================================================

// Canvas events: drag, add node, add edge, delete node/edge
canvas.addEventListener('mousedown', (e)=>{
  if(isRunning) return;
  const pos = getMousePos(e);
  const hit = findNodeAt(pos.x,pos.y);
  currentMode = modeSelect.value === 'move' ? currentMode : modeSelect.value;

  // delete node
  if(currentMode === 'deleteNode' && hit){
    nodes = nodes.filter(n => n.id !== hit.id);
    edges = edges.filter(e => e.from !== hit.id && e.to !== hit.id);
    refreshSelects(); draw();
    addStep(`Deleted node ${hit.label} and its edges.`);
    currentMode='move'; return;
  }

  // delete edge
  if(currentMode === 'deleteEdge'){
    let removed=false;
    edges = edges.filter(e=>{
      const a=nodes.find(n=>n.id===e.from), b=nodes.find(n=>n.id===e.to);
      const dist = pointLineDistance(pos, a, b);
      if(dist < 20 && !removed){
        addStep(`Deleted edge ${a.label} ↔ ${b.label}`);
        removed=true; return false;
      }
      return true;
    });
    draw(); currentMode='move'; return;
  }

  // existing modes
  if(modeSelect.value === 'move'){
    if(hit){ dragging = hit; dragOffset.x = pos.x - hit.x; dragOffset.y = pos.y - hit.y; hit._active=true; draw(); }
  } else if(modeSelect.value === 'addNode'){
    addNode(pos.x,pos.y); addStep('Added node at canvas position.');
  } else if(modeSelect.value === 'addEdge'){
    if(hit){
      if(!selection || !selection.start){
        selection = { start:{x:hit.x,y:hit.y, id:hit.id}, x:pos.x, y:pos.y };
        addStep(`Started edge from ${hit.label}. Click a target node to finish and set weight.`);
      } else {
        if(hit.id === selection.start.id){ selection=null; draw(); return; }
        const weight = prompt(`Weight for edge ${nodes.find(n=>n.id===selection.start.id).label} → ${hit.label}`, '1');
        if(weight !== null && !isNaN(weight)){
          addEdge(selection.start.id, hit.id, parseFloat(weight));
          addStep(`Created edge ${nodes.find(n=>n.id===selection.start.id).label} ↔ ${hit.label} with weight ${weight}`);
        }
        selection=null;
      }
    }
  }
});

canvas.addEventListener('mousemove', (e)=>{
  const pos = getMousePos(e);
  if(dragging){
    dragging.x = pos.x - dragOffset.x; dragging.y = pos.y - dragOffset.y;
    draw();
  } else if(selection){
    selection.x = pos.x; selection.y = pos.y; draw();
  }
});
canvas.addEventListener('mouseup', ()=>{ if(dragging) { dragging._active=false; dragging=null; draw(); } });

// Reset and clear
resetBtn.addEventListener('click', ()=>{
  nodes=[]; edges=[]; nodeCounter=0; stepsDiv.innerHTML=''; progressFill.style.width='0%'; progressText.innerText='Idle';
  refreshSelects(); draw();
  addStep('Canvas reset.');
});
clearEdgesBtn.addEventListener('click', ()=>{ edges=[]; draw(); addStep('Removed all edges.'); });

// generate
generateBtn.addEventListener('click', ()=>{ generatePreset(); });

// speed slider
speedSlider.addEventListener('input', ()=>{
  animSpeed = parseFloat(speedSlider.value);
  speedLabel.innerText = animSpeed < 0.75 ? 'Slow' : animSpeed>1.5 ? 'Fast' : 'Normal';
});

// theme toggle
themeToggle.addEventListener('change', ()=>{ document.body.classList.toggle('light', themeToggle.checked); });

// export steps
exportBtn.addEventListener('click', ()=>{
  const win = window.open('', '', 'width=800,height=600');
  const html = `
    <html><head><title>Export: Dijkstra Steps</title>
    <style>body{font-family:Inter,Arial;padding:20px;color:#222} .step{margin-bottom:8px}</style></head>
    <body><h2>Execution Steps</h2>${stepsDiv.innerHTML}</body></html>`;
  win.document.write(html); win.document.close(); win.print();
});

// pseudocode toggle
pseudocodeToggle.addEventListener('change', ()=>{ pseudocodePanel.style.display = pseudocodeToggle.checked ? 'block' : 'none' });

// ====== Dijkstra Algorithm with visualization ======
async function runDijkstra(){
  if(isRunning) return;
  if(nodes.length===0){ alert('Add or generate a graph first.'); return; }
  isRunning = true;
  stepsDiv.innerHTML='';
  const adj = {};
  nodes.forEach(n => { adj[n.id] = {}; n._visited=false; n._isSource=false; n._isDest=false; });
  edges.forEach(e => { adj[e.from][e.to] = e.weight; adj[e.to][e.from] = e.weight; });

  const srcId = sourceSelect.value || nodes[0].id;
  const destId = destSelect.value || nodes[nodes.length-1].id;
  nodes.forEach(n=>{ if(n.id===srcId) n._isSource=true; if(n.id===destId) n._isDest=true });

  const dist = {}; const prev = {}; const visited = {};
  nodes.forEach(n=>{ dist[n.id]=Infinity; prev[n.id]=null; visited[n.id]=false; });
  dist[srcId] = 0;

  addStep(`Starting Dijkstra from ${nodes.find(n=>n.id===srcId).label} to ${nodes.find(n=>n.id===destId).label}`);
  highlightPseudo(0);

  const totalSteps = nodes.length;
  let stepCount = 0;

  for(let iter=0; iter<nodes.length; iter++){
    let u = null;
    for(let id in dist){
      if(!visited[id] && (u===null || dist[id] < dist[u])) u = id;
    }
    if(u===null) break;
    visited[u]=true; nodes.find(n=>n.id===u)._visited=true;
    addStep(`Visiting node ${nodes.find(n=>n.id===u).label} with current distance ${dist[u] === Infinity ? '∞' : dist[u]}`);
    highlightPseudo(4);
    await animateVisit(u);

    highlightPseudo(5);
    for(const v in adj[u]){
      highlightPseudo(6);
      const alt = dist[u] + adj[u][v];
      addStep(`Checking neighbor ${nodes.find(n=>n.id===v).label}: alt = ${dist[u]} + ${adj[u][v]} = ${alt}`);
      if(alt < dist[v]){
        dist[v] = alt; prev[v] = u;
        addStep(`Updated distance of ${nodes.find(n=>n.id===v).label} to ${alt}`);
        highlightPseudo(8);
      }
      await sleep(400 / animSpeed);
    }

    stepCount++;
    const pct = Math.round((stepCount/totalSteps)*100);
    progressFill.style.width = pct + '%';
    progressText.innerText = `Processing: ${pct}%`;
    await sleep(300 / animSpeed);
  }

  const path = [];
  let cur = destId;
  while(cur){ path.unshift(cur); cur = prev[cur]; }
  if(path.length===0 || dist[destId]===Infinity){
    addStep('No path found to destination.');
  } else {
    addStep(`Shortest path found with distance ${dist[destId]}: ${path.map(id=>nodes.find(n=>n.id===id).label).join(' → ')}`);
    await animatePathGlow(path);
  }

  highlightPseudo(null);
  progressText.innerText = 'Completed';
  isRunning=false;
  setTimeout(()=> quizBtn.classList.add('pulse'), 600);
}

// animations
function sleep(ms){ return new Promise(r=>setTimeout(r, ms)); }
async function animateVisit(nodeId){
  const node = nodes.find(n=>n.id===nodeId);
  for(let i=0;i<2;i++){
    node._active = true; draw(); await sleep(120/animSpeed);
    node._active = false; draw(); await sleep(80/animSpeed);
  }
}
async function animatePathGlow(pathIds){
  for(let i=0;i<pathIds.length-1;i++){
    const aId = pathIds[i], bId = pathIds[i+1];
    clearCanvas();
    edges.forEach(e=>{
      const na = nodes.find(n=>n.id===e.from), nb = nodes.find(n=>n.id===e.to);
      const match = ( (e.from===aId && e.to===bId) || (e.from===bId && e.to===aId) );
      drawEdge(na, nb, e.weight, true, match);
    });
    nodes.forEach(n=> drawNode(n, n._visited ? 'rgba(46,160,67,0.9)' : null));
    await sleep(360/animSpeed);
  }
  for(let p=0;p<3;p++){
    clearCanvas();
    edges.forEach(e=>{
      const na = nodes.find(n=>n.id===e.from), nb = nodes.find(n=>n.id===e.to);
      const inPath = pathIds.reduce((acc,cur,i,arr)=> acc || (arr[i]===e.from && arr[i+1]===e.to) || (arr[i]===e.to && arr[i+1]===e.from), false);
      drawEdge(na,nb,e.weight,true,inPath);
    });
    nodes.forEach(n=> drawNode(n));
    await sleep(220/animSpeed);
    draw(); await sleep(180/animSpeed);
  }
}

// UI wiring
runBtn.addEventListener('click', runDijkstra);

// initial demo graph
generatePreset();
refreshSelects();

// quiz
quizBtn.addEventListener('click', ()=>{
  if(nodes.length===0){ alert('Generate a graph first'); return; }
  quizModal.classList.remove('hidden');
  const q = {question:'Which node is the source (start)?', choices: nodes.map(n=>n.label), answer: nodes.find(n=>n._isSource)?.label || nodes[0].label};
  quizContent.innerHTML = `<p>${q.question}</p>` + q.choices.map((c,i)=>`<label><input type="radio" name="q" value="${c}" ${i===0?'checked':''}/> ${c}</label><br>`).join('');
  quizModal._q = q;
});
closeQuiz.addEventListener('click', ()=> quizModal.classList.add('hidden'));
submitQuiz.addEventListener('click', ()=>{
  const selected = quizContent.querySelector('input[name=q]:checked')?.value;
  const correct = quizModal._q.answer;
  if(selected === correct) addStep('Quiz: Correct! Well done.');
  else addStep(`Quiz: Incorrect — correct answer is ${correct}.`);
  quizModal.classList.add('hidden');
});

// pseudocode click
pseudocodePre.addEventListener('click', (e)=>{
  const line = e.target.closest('.pseudocode-line');
  if(!line) return;
  const idx = parseInt(line.dataset.idx);
  highlightPseudo(idx);
  addStep(`Pseudocode: highlighted line ${idx+1}`);
});

// keep selects updated
const obs = new MutationObserver(refreshSelects);
obs.observe(stepsDiv, { childList:true });

// speed label
speedLabel.innerText = 'Normal';

// HiDPI
function setupHiDPI(){
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.floor(canvas.clientWidth * dpr);
  canvas.height = Math.floor(canvas.clientHeight * dpr);
  ctx.scale(dpr,dpr);
}
setupHiDPI();
draw();
