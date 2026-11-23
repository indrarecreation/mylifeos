/* MY LIFE OS frontend. Configure API_URL before deployment. */
const API_URL = "PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE";
const $ = (id) => document.getElementById(id);
let authMode = "login";
let sessionToken = localStorage.getItem("mylifeos_session") || "";
let currentUser = null;
let records = [];

const todayISO = () => new Date().toISOString().slice(0,10);
const money = n => new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:2}).format(Number(n)||0);
const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const toast = msg => { const el=$("toast"); el.textContent=msg; el.classList.add("show"); setTimeout(()=>el.classList.remove("show"),2600); };
const setAuthMessage = msg => $("authMessage").textContent=msg;

async function api(action, data={}) {
  if (!API_URL || API_URL.includes("PASTE_YOUR")) throw new Error("Add your deployed Apps Script URL in frontend/app.js first.");
  const response = await fetch(API_URL, {
    method:"POST",
    headers:{"Content-Type":"text/plain;charset=utf-8"},
    body:JSON.stringify({action, token:sessionToken, ...data}),
    redirect:"follow"
  });
  if (!response.ok) throw new Error("Server request failed ("+response.status+").");
  const result = await response.json();
  if (!result.ok) throw new Error(result.error || "Something went wrong.");
  return result;
}

function setAuthTab(mode){
  authMode=mode;
  document.querySelectorAll("[data-auth-tab]").forEach(b=>b.classList.toggle("active",b.dataset.authTab===mode));
  $("nameField").classList.toggle("hidden",mode!=="register");
  $("fullName").required=mode==="register";
  $("authSubmit").textContent=mode==="register"?"Create account":"Sign in";
  $("password").autocomplete=mode==="register"?"new-password":"current-password";
  setAuthMessage("");
}
document.querySelectorAll("[data-auth-tab]").forEach(b=>b.addEventListener("click",()=>setAuthTab(b.dataset.authTab)));

$("authForm").addEventListener("submit",async e=>{
  e.preventDefault(); setAuthMessage("Connecting securely...");
  const payload={email:$("email").value.trim(),password:$("password").value};
  if(authMode==="register") payload.name=$("fullName").value.trim();
  try{
    const res=await api(authMode==="register"?"register":"login",payload);
    sessionToken=res.token; localStorage.setItem("mylifeos_session",sessionToken);
    currentUser=res.user; showApp(); await loadRecords();
  }catch(err){setAuthMessage(err.message);}
});

function showApp(){
  $("authView").classList.add("hidden");$("appView").classList.remove("hidden");
  $("userName").textContent=currentUser.name;$("userRole").textContent=currentUser.role;
  $("userAvatar").textContent=(currentUser.name||"U").charAt(0).toUpperCase();
  $("todayLabel").textContent=new Date().toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"long",year:"numeric"}).toUpperCase();
  const h=new Date().getHours();$("greeting").textContent=(h<12?"Good morning":h<17?"Good afternoon":"Good evening")+", "+currentUser.name.split(" ")[0]+".";
}
async function boot(){
  if("serviceWorker" in navigator) navigator.serviceWorker.register("./service-worker.js").catch(()=>{});
  if(!sessionToken)return;
  try{const res=await api("me");currentUser=res.user;showApp();await loadRecords();}
  catch(e){localStorage.removeItem("mylifeos_session");sessionToken="";}
}
$("logoutBtn").addEventListener("click",async()=>{try{await api("logout")}catch(e){}localStorage.removeItem("mylifeos_session");sessionToken="";currentUser=null;$("appView").classList.add("hidden");$("authView").classList.remove("hidden");toast("Signed out");});
$("menuBtn").addEventListener("click",()=>$("sidebar").classList.toggle("open"));

function goPage(page){
  document.querySelectorAll(".page").forEach(p=>p.classList.toggle("active",p.id==="page-"+page));
  document.querySelectorAll(".nav-item[data-page]").forEach(b=>b.classList.toggle("active",b.dataset.page===page));
  $("pageTitle").textContent=({overview:"Overview",activities:"Activities",tasks:"Tasks & plans",routines:"Routines",notes:"Notes",expenses:"Pocket / expenses"})[page]||"Overview";
  $("sidebar").classList.remove("open");
}
document.querySelectorAll(".nav-item[data-page]").forEach(b=>b.addEventListener("click",()=>goPage(b.dataset.page)));
document.querySelectorAll("[data-go]").forEach(b=>b.addEventListener("click",()=>goPage(b.dataset.go)));

async function loadRecords(){
  try{const res=await api("listRecords",{limit:500});records=res.records||[];renderAll();}
  catch(e){toast(e.message);}
}
function renderAll(){
  const today=todayISO();
  const acts=records.filter(r=>r.type==="activity"&&String(r.createdAt||"").slice(0,10)===today);
  const tasks=records.filter(r=>r.type==="task"&&r.status!=="done");
  const expenses=records.filter(r=>r.type==="expense"&&String(r.createdAt||"").slice(0,10)===today);
  const notes=records.filter(r=>r.type==="note");
  $("statActivities").textContent=acts.length;$("statTasks").textContent=tasks.length;
  $("statExpenses").textContent=money(expenses.reduce((s,r)=>s+Number(r.amount||0),0));$("statNotes").textContent=notes.length;
  $("expenseTotal").textContent=money(records.filter(r=>r.type==="expense").reduce((s,r)=>s+Number(r.amount||0),0));
  renderList("recentList",records.slice(0,6),false);
  renderList("activityList",records.filter(r=>r.type==="activity"),true);
  renderList("taskList",tasks,true);
  renderList("routineList",records.filter(r=>r.type==="routine"),true);
  renderNotes(notes);renderList("expenseList",records.filter(r=>r.type==="expense"),true,true);
}
function renderList(id,list,actions=true,showAmount=false){
  const el=$(id);if(!list.length){el.innerHTML='<p class="muted">Nothing recorded here yet.</p>';return;}
  el.innerHTML=list.map(r=>`<div class="record-item"><div><h4>${escapeHTML(r.title)} ${showAmount&&r.amount?`<span style="color:#73dbb3">· ${money(r.amount)}</span>`:""}</h4><p>${escapeHTML(r.description||r.category||"")}</p></div><div><div class="record-meta">${escapeHTML(r.category||r.type)} · ${escapeHTML((r.createdAt||"").slice(0,16).replace("T"," "))}</div>${actions&&r.type==="task"&&r.status!=="done"?`<div class="record-actions" style="margin-top:7px"><button class="mini-btn" data-done="${escapeHTML(r.id)}">Mark done</button></div>`:""}</div></div>`).join("");
  el.querySelectorAll("[data-done]").forEach(b=>b.addEventListener("click",()=>updateStatus(b.dataset.done)));
}
function renderNotes(list){
  const q=($("noteSearch")?.value||"").toLowerCase();
  const filtered=list.filter(r=>(r.title+" "+r.description).toLowerCase().includes(q));
  $("noteList").innerHTML=filtered.length?filtered.map(r=>`<article class="note-card"><h3>${escapeHTML(r.title)}</h3><p>${escapeHTML(r.description||"")}</p><small class="muted">${escapeHTML(r.category||"Note")} · ${escapeHTML((r.createdAt||"").slice(0,10))}</small></article>`).join(""):'<p class="muted">No matching notes.</p>';
}
$("noteSearch").addEventListener("input",()=>renderNotes(records.filter(r=>r.type==="note")));
$("activitySearch").addEventListener("input",filterActivities);$("activityFilter").addEventListener("change",filterActivities);
function filterActivities(){const q=$("activitySearch").value.toLowerCase(),cat=$("activityFilter").value;renderList("activityList",records.filter(r=>r.type==="activity"&&(!cat||r.category===cat)&&(r.title+" "+r.description).toLowerCase().includes(q)),true);}

function openCapture(kind){
  $("captureForm").reset();$("recordType").value=kind||"activity";$("recordDate").value=new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16);
  $("amountWrap").classList.toggle("hidden",kind!=="expense");$("captureTitle").textContent="Create "+(kind||"record");
  $("captureDialog").showModal();
}
document.querySelectorAll("[data-open-capture]").forEach(b=>b.addEventListener("click",()=>openCapture(b.dataset.kind||"activity")));
$("recordType").addEventListener("change",()=>{$("amountWrap").classList.toggle("hidden",$("recordType").value!=="expense");});
$("closeDialog").addEventListener("click",()=>$("captureDialog").close());$("cancelCapture").addEventListener("click",()=>$("captureDialog").close());
$("captureForm").addEventListener("submit",async e=>{
  e.preventDefault();const type=$("recordType").value;
  const record={type,title:$("recordTitle").value.trim(),description:$("recordDescription").value.trim(),category:$("recordCategory").value,occurredAt:$("recordDate").value,amount:type==="expense"?Number($("recordAmount").value||0):""};
  try{await api("createRecord",{record});$("captureDialog").close();toast("Record saved");await loadRecords();}
  catch(err){$("captureMessage").textContent=err.message;}
});
async function updateStatus(id){try{await api("updateRecord",{id,patch:{status:"done"}});toast("Task completed");await loadRecords();}catch(e){toast(e.message);}}

async function quickSave(){
  const text=$("quickText").value.trim();if(!text)return toast("Write something first.");
  try{
    const ai=await api("classify",{text});
    const draft=ai.record||{};
    $("recordType").value=draft.type||"activity";$("recordTitle").value=draft.title||text.slice(0,100);
    $("recordDescription").value=draft.description||text;$("recordCategory").value=draft.category||"Personal";
    $("recordAmount").value=draft.amount||"";$("amountWrap").classList.toggle("hidden",$("recordType").value!=="expense");
    $("recordDate").value=new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16);
    $("captureDialog").showModal();$("quickText").value="";
  }catch(e){toast("AI classification unavailable: "+e.message+" You can add it manually.");openCapture("activity");$("recordTitle").value=text.slice(0,140);$("recordDescription").value=text;}
}
$("quickSave").addEventListener("click",quickSave);
$("askAi").addEventListener("click",async()=>{
  const prompt=$("aiPrompt").value.trim();if(!prompt)return;
  $("aiAnswer").textContent="Thinking...";
  try{const r=await api("assistant",{prompt});$("aiAnswer").textContent=r.answer||"No response.";}
  catch(e){$("aiAnswer").textContent=e.message;}
});
boot();