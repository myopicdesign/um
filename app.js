const moods = [
  { label:"Ansioso",    accent:"#74f79a", img:"https://picsum.photos/900/900?1"  },
  { label:"Curioso",    accent:"#74f79a", img:"https://picsum.photos/900/900?2"  },
  { label:"Dopaminico", accent:"#ffd35a", img:"https://picsum.photos/900/900?3"  },
  { label:"Timoroso",   accent:"#ff7ad9", img:"https://picsum.photos/900/900?4"  },
  { label:"Rilassato",  accent:"#74f79a", img:"https://picsum.photos/900/900?5"  },
  { label:"Motivato",   accent:"#ffd35a", img:"https://picsum.photos/900/900?6"  },
  { label:"Nostalgico", accent:"#78a6ff", img:"https://picsum.photos/900/900?7"  },
  { label:"Incerto",    accent:"#b892ff", img:"https://picsum.photos/900/900?8"  },
  { label:"Spompato",   accent:"#ff8e6b", img:"https://picsum.photos/900/900?9"  },
  { label:"Felice",     accent:"#ffd35a", img:"https://picsum.photos/900/900?10" },
];

const mask = document.getElementById("mask");
const selector = document.getElementById("selector");
const highlight = document.getElementById("highlight");
const barsTrack = document.getElementById("barsTrack");
const labelsTrack = document.getElementById("labelsTrack");

const avatarsViewport = document.getElementById("avatarsViewport");
const avatarsTrack = document.getElementById("avatarsTrack");

const modal = document.getElementById("modal");
const closeModalBtn = document.getElementById("closeModal");
const modalText = document.getElementById("modalText");

// ====== BUILD BARS ======
// più barre totali = wrap più pulito quando riduci gap (visivamente migliore)
const BAR_COUNT = 820;
for (let i=0;i<BAR_COUNT;i++){
  const b=document.createElement("div");
  b.className="bar";
  barsTrack.appendChild(b);
}

// ====== BUILD LABELS ======
const labelEls = moods.map((m,i)=>{
  const el=document.createElement("div");
  el.className="label";
  el.textContent=m.label;
  el.onclick=()=>snapToIndex(i,true);
  labelsTrack.appendChild(el);
  return el;
});

// ====== BUILD AVATARS ======
const avatarCellEls = moods.map((m)=>{
  const cell=document.createElement("div");
  cell.className="avatar-cell";

  const img=document.createElement("img");
  img.className="avatar";
  img.src=m.img;
  img.alt=m.label;

  cell.appendChild(img);
  avatarsTrack.appendChild(cell);
  return cell;
});
const avatarImgEl = (i)=>avatarCellEls[i]?.querySelector(".avatar");

// ====== GEOMETRY ======
let snapCenters=[], minX=0, maxX=0;

function computeSnap(){
  const centerX = selector.clientWidth/2;
  snapCenters = labelEls.map(el=>el.offsetLeft + el.offsetWidth/2);
  maxX = centerX - snapCenters[0];
  minX = centerX - snapCenters[snapCenters.length-1];
}

const clamp = x => Math.max(minX, Math.min(maxX, x));
const mod = (n,m)=>((n%m)+m)%m;

function readCSSNumber(varName){
  const v = getComputedStyle(document.documentElement).getPropertyValue(varName);
  return parseFloat(v) || 0;
}

let BAR_W=0, GAP=0, STEP=0, LOOP=0;
let gapCenterInStep=0;

// 🔥 loop più grande perché ora hai più barre visibili (densità maggiore)
const LOOP_STEPS = 120;

function refreshBarMetrics(){
  BAR_W = readCSSNumber("--bar-w");
  GAP   = readCSSNumber("--bar-gap");
  STEP  = BAR_W + GAP;
  LOOP  = STEP * LOOP_STEPS;
  gapCenterInStep = BAR_W + GAP/2;
}

function measureRealGapCenter(){
  const bars = barsTrack.querySelectorAll(".bar");
  if (bars.length < 2) return;

  const r0 = bars[0].getBoundingClientRect();
  const r1 = bars[1].getBoundingClientRect();
  const trackRect = barsTrack.getBoundingClientRect();

  const gapCenter = (r0.right + r1.left) / 2;
  const firstBarLeft = r0.left - trackRect.left;

  gapCenterInStep = (gapCenter - trackRect.left) - firstBarLeft;
  gapCenterInStep = mod(gapCenterInStep, STEP);
}

function autoPadBarsToCenterGap(){
  const centerX = mask.clientWidth / 2;
  const trackStyle = getComputedStyle(barsTrack);
  const padLeft = parseFloat(trackStyle.paddingLeft) || 0;

  const desired = gapCenterInStep;
  const r = mod(centerX - padLeft, STEP);

  let err = desired - r;
  if (err >  STEP/2) err -= STEP;
  if (err < -STEP/2) err += STEP;

  const newPad = padLeft - err;
  document.documentElement.style.setProperty("--bars-pad", `${newPad}px`);
}

// larghezza avatar-cell = larghezza label (centri identici)
function syncAvatarCellWidthsToLabels(){
  for (let i=0;i<labelEls.length;i++){
    avatarCellEls[i].style.width = labelEls[i].offsetWidth + "px";
  }
}

// ====== STATE ======
let targetX=0, currentX=0, activeIndex=1;
const EASE=.11, WHEEL_SENS=.55, SNAP_DELAY=160;
let snapTimer=null;

// popup idle
const POPUP_DELAY_MS = 3000;
let popupTimer = null;

function setAccent(color){
  document.documentElement.style.setProperty("--accent", color);
  const r=parseInt(color.slice(1,3),16),
        g=parseInt(color.slice(3,5),16),
        b=parseInt(color.slice(5,7),16);
  const yiq=(r*299+g*587+b*114)/1000;
  document.documentElement.style.setProperty(
    "--active-text",
    yiq>160 ? "rgba(10,10,10,.92)" : "rgba(255,255,255,.95)"
  );
}

function setActive(i){
  activeIndex=i;

  labelEls.forEach((l,idx)=>l.classList.toggle("active", idx===i));

  for (let k=0;k<avatarCellEls.length;k++){
    const img = avatarImgEl(k);
    if (!img) continue;
    img.classList.toggle("active", k===i);
  }

  setAccent(moods[i].accent);
  highlight.style.width = labelEls[i].offsetWidth + "px";
}

function nearestIndexFromX(x){
  const centerX = selector.clientWidth/2;
  let bestI=0, bestD=1e9;
  for(let i=0;i<snapCenters.length;i++){
    const d = Math.abs((snapCenters[i]+x)-centerX);
    if(d<bestD){bestD=d;bestI=i;}
  }
  return bestI;
}

function snapToIndex(i, animated){
  const centerX = selector.clientWidth/2;
  targetX = clamp(centerX - snapCenters[i]);
  if(!animated) currentX = targetX;
  setActive(i);
  schedulePopup();
}

function applyRubber(x){
  if (x > maxX) return maxX + (x-maxX)*0.35;
  if (x < minX) return minX + (x-minX)*0.35;
  return x;
}

function schedulePopup(){
  clearTimeout(popupTimer);
  popupTimer = setTimeout(() => {
    openModalForMood(moods[activeIndex]?.label || "…");
  }, POPUP_DELAY_MS);
}

function openModalForMood(moodName){
  modalText.textContent =
    `“Un consiglio per quando ti senti ${moodName.toLowerCase()}: fai una cosa piccola, ma falla davvero.”`;
  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden","false");
}

function closeModal(){
  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden","true");
  schedulePopup();
}

function onInput(delta){
  targetX = applyRubber(targetX + delta);

  const i = nearestIndexFromX(currentX);
  if (i !== activeIndex) setActive(i);

  clearTimeout(snapTimer);
  snapTimer = setTimeout(()=>snapToIndex(nearestIndexFromX(targetX), true), SNAP_DELAY);

  if (modal.classList.contains("is-open")) closeModal();
  schedulePopup();
}

function animate(){
  currentX += (targetX-currentX)*EASE;

  // sync labels + avatars
  labelsTrack.style.transform  = `translate3d(${currentX}px,0,0)`;
  avatarsTrack.style.transform = `translate3d(${currentX}px,0,0)`;

  // bars
  const atRest = Math.abs(targetX-currentX) < 0.25;
  let base = -currentX;

  base = atRest ? Math.round(base/STEP)*STEP : Math.round(base);

  const wrapped = mod(base, LOOP);
  barsTrack.style.transform = `translate3d(${-wrapped}px,0,0)`;

  requestAnimationFrame(animate);
}

// wheel
function wheelHandler(e){
  const raw = (Math.abs(e.deltaX)>Math.abs(e.deltaY)) ? e.deltaX : e.deltaY;
  onInput(-raw*WHEEL_SENS);
  e.preventDefault();
}
mask.addEventListener("wheel", wheelHandler, {passive:false});
selector.addEventListener("wheel", wheelHandler, {passive:false});
avatarsViewport.addEventListener("wheel", wheelHandler, {passive:false});

// drag
let down=false, lastX=0;
function startDrag(e){
  down=true; lastX=e.clientX;
  clearTimeout(snapTimer);
  e.currentTarget.setPointerCapture(e.pointerId);
}
function moveDrag(e){
  if(!down) return;
  const dx=e.clientX-lastX;
  lastX=e.clientX;
  onInput(dx*1.1);
}
function endDrag(){
  down=false;
  snapToIndex(nearestIndexFromX(targetX), true);
}
[mask, selector, avatarsViewport].forEach(el=>{
  el.addEventListener("pointerdown", startDrag);
  el.addEventListener("pointermove", moveDrag);
  el.addEventListener("pointerup", endDrag);
  el.addEventListener("pointercancel", endDrag);
});

// modal close
closeModalBtn.addEventListener("click", closeModal);
modal.addEventListener("click", (e)=>{ if(e.target === modal) closeModal(); });

// INIT
function init(){
  refreshBarMetrics();

  computeSnap();
  syncAvatarCellWidthsToLabels();
  computeSnap();

  measureRealGapCenter();
  autoPadBarsToCenterGap();
  measureRealGapCenter();

  snapToIndex(activeIndex,false);
  requestAnimationFrame(animate);
  schedulePopup();
}

window.addEventListener("load", init);
window.addEventListener("resize", ()=>{
  refreshBarMetrics();

  computeSnap();
  syncAvatarCellWidthsToLabels();
  computeSnap();

  measureRealGapCenter();
  autoPadBarsToCenterGap();
  measureRealGapCenter();

  snapToIndex(activeIndex,false);
});
