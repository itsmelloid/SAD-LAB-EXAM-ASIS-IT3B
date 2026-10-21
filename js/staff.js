let subs=[],progs=[];
(async()=>{
  const me=await requireRole("staff"); if(!me)return;
  document.getElementById("who").textContent=me.full_name;
  const {data}=await db.from("scholarship_programs").select("*");progs=data||[];
  document.getElementById("f-prog").innerHTML+=progs.map(p=>`<option>${esc(p.name)}</option>`).join("");
  document.getElementById("a-prog").innerHTML=progs.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join("");
  load();loadScholars();
})();
async function load(){
  const {data,error}=await db.from("semester_submissions").select(SUB_SELECT+", renewal_decisions(decision,decided_at)").order("submitted_at");
  if(error)return showMsg("msg",error.message,"err");
  subs=data;render();
}
function latestDecision(s){const d=[...(s.renewal_decisions||[])].sort((a,b)=>a.decided_at<b.decided_at?1:-1)[0];return d?d.decision:"None";}
function render(){
  const q=document.getElementById("q").value.toLowerCase(),fp=document.getElementById("f-prog").value,
    fs=document.getElementById("f-sem").value,fc=document.getElementById("f-comp").value;
  const list=subs.filter(s=>(!q||(s.profiles.full_name+" "+s.profiles.student_id).toLowerCase().includes(q))
    &&(!fp||s.scholarship_programs.name===fp)&&(!fs||s.semester===fs)&&(!fc||s.compliance_status===fc));
  const c=k=>subs.filter(k).length;
  document.getElementById("c-total").textContent=new Set(subs.map(s=>s.scholar_id)).size;
  document.getElementById("c-pend").textContent=c(s=>s.verification_status==="Pending verification");
  document.getElementById("c-ok").textContent=c(s=>s.compliance_status==="Compliant");
  document.getElementById("c-def").textContent=c(s=>s.compliance_status==="With Deficiency");
  document.getElementById("rows").innerHTML=list.map(s=>`<tr><td>${esc(s.profiles.student_id)}</td><td>${esc(s.profiles.full_name)}</td><td>${esc(s.scholarship_programs.name)}</td><td>${esc(s.academic_year)} / ${esc(s.semester)}</td><td>${esc(s.gwa)}</td><td>${badge(s.verification_status)}</td><td>${badge(s.compliance_status)}</td><td>${badge(latestDecision(s))}</td>
  <td><button class="alt" onclick="detail('${s.id}')">View</button></td></tr>`).join("")||"<tr><td colspan=9>No submissions match.</td></tr>";
}
async function act(p){const {error}=await p;showMsg("msg",error?error.message:"Done.",error?"err":"ok");await load();}
async function detail(id){
  const s=subs.find(x=>x.id===id),h=await loadHistory(id);
  setTimeout(()=>document.getElementById("detail").scrollIntoView({behavior:"smooth"}),0);
  document.getElementById("detail").innerHTML=`<h2>${esc(s.profiles.full_name)}: ${esc(s.academic_year)} sem ${esc(s.semester)}</h2>
  <p>GWA ${esc(s.gwa)}, units ${esc(s.enrolled_units)}, failed ${esc(s.failed_count)}, INC ${esc(s.incomplete_count)}, dropped ${esc(s.dropped_count)}. Document: ${esc(s.evidence_reference)}</p>
  <p>${badge(s.verification_status)} ${badge(s.compliance_status)} Feedback: ${esc(s.verification_reason||"None")}</p>
  <button onclick="verify('${id}',true)">Mark verified</button><button class="alt" onclick="verify('${id}',false)">Return for correction</button>
  <button class="gold" onclick="doEval('${id}')">Evaluate compliance</button>
  <button onclick="decide('${id}','Approved')">Approve renewal</button><button class="alt" onclick="decide('${id}','Held')">Hold renewal</button>
  ${checksHtml(s.deficiency_reasons)}
  <h3>Decision history</h3>${h.decisions.map(d=>`<p>${badge(d.decision)} by ${esc(d.profiles?.full_name)} on ${pht(d.decided_at)}: ${esc(d.decision_notes)}</p>`).join("")||"<p>None yet.</p>"}${historyHtml(h)}`;
}
async function verify(id,ok){
  let r=null;if(!ok){r=prompt("Reason for returning (required):");if(!r)return;}
  await act(db.rpc("verify_submission",{p_id:id,p_ok:ok,p_reason:r}));detail(id);
}
async function doEval(id){await act(evaluate(id));detail(id);}
async function decide(id,d){
  const s=subs.find(x=>x.id===id);
  if(!s)return showMsg("msg","Could not find this submission. Refresh and try again.","err");
  if(s.verification_status!=="Verified")return showMsg("msg","Verify the evidence before recording a renewal decision.","err");
  if(s.compliance_status==="Not evaluated")return showMsg("msg","Evaluate compliance before recording a renewal decision.","err");
  if(d==="Approved"&&s.compliance_status!=="Compliant")return showMsg("msg","This submission has deficiencies and cannot be approved. You can place it on hold.","err");
  const n=prompt("Decision notes (required):");if(n===null)return;
  if(!n.trim())return showMsg("msg","Decision notes are required.","err");
  await act(db.rpc("record_decision",{p_id:id,p_decision:d,p_notes:n.trim()}));detail(id);
}
async function loadScholars(){
  const {data}=await db.from("profiles").select("id,full_name,student_id,scholar_assignments(scholarship_programs(name))").eq("role","scholar").order("full_name");
  document.getElementById("a-who").innerHTML=(data||[]).map(p=>`<option value="${p.id}">${esc(p.full_name)}</option>`).join("");
  const prog=p=>{const a=p.scholar_assignments;return (Array.isArray(a)?a[0]:a)?.scholarship_programs?.name||"Unassigned";};
  document.getElementById("a-rows").innerHTML=(data||[]).map(p=>`<tr><td>${esc(p.student_id||"-")}</td><td>${esc(p.full_name)}</td><td>${esc(prog(p))}</td></tr>`).join("");
}
async function assign(e){
  e.preventDefault();
  const sid=document.getElementById("a-sid").value.trim();if(!sid)return showMsg("msg","Student ID is required.","err");
  await act(db.rpc("assign_scholar",{p_scholar:document.getElementById("a-who").value,p_student_id:sid,p_program:Number(document.getElementById("a-prog").value)}));loadScholars();
}
