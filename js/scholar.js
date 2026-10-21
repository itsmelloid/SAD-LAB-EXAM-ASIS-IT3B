let me, subs=[];
(async()=>{
  me=await requireRole("scholar"); if(!me)return;
  document.getElementById("who").textContent=me.full_name+" · "+(me.student_id||"no student ID");
  const {data:a}=await db.from("scholar_assignments").select("scholarship_programs(name)").eq("scholar_id",me.id).maybeSingle();
  document.getElementById("prog").textContent=a?.scholarship_programs?.name||"Not assigned yet";
  load();
})();
async function load(){
  const {data,error}=await db.from("semester_submissions").select(SUB_SELECT).order("submitted_at",{ascending:false});
  if(error)return showMsg("msg","Could not load submissions: "+error.message,"err");
  subs=data;
  const n=s=>subs.filter(x=>x.verification_status===s).length;
  document.getElementById("c-total").textContent=subs.length;
  document.getElementById("c-pend").textContent=n("Pending verification");
  document.getElementById("c-ver").textContent=n("Verified");
  document.getElementById("c-comp").innerHTML=subs[0]?badge(subs[0].compliance_status):"—";
  document.getElementById("rows").innerHTML=subs.map(s=>`<tr><td>${esc(s.academic_year)} / ${esc(s.semester)}</td><td>${esc(s.gwa)}</td><td>${badge(s.verification_status)}</td><td>${badge(s.compliance_status)}</td><td><button class="alt" onclick="detail('${s.id}')">View</button></td></tr>`).join("")||"<tr><td colspan=5>No submissions yet. Use the form above.</td></tr>";
}
function readForm(p){const g=i=>document.getElementById(p+i).value;
  return {year:g("year"),sem:g("sem"),gwa:parseFloat(g("gwa")),units:Number(g("units")),failed:Number(g("failed")),inc:Number(g("inc")),drop:Number(g("drop")),ref:g("ref")};}
async function submitForm(e){
  e.preventDefault();const v=readForm(""),errs=validateSubmission(v);
  if(errs.length)return showMsg("msg",errs.join(" "),"err");
  const {error}=await createSubmission(v);
  if(error)return showMsg("msg",error.message,"err");
  showMsg("msg","Saved. Status: Pending verification.","ok");e.target.reset();load();
}
async function detail(id){
  const s=subs.find(x=>x.id===id),h=await loadHistory(id);
  let html=`<h2>${esc(s.academic_year)} semester ${esc(s.semester)}</h2><p>${badge(s.verification_status)} ${badge(s.compliance_status)}</p>
  <p>Staff feedback: ${esc(s.verification_reason||"None")}</p>${checksHtml(s.deficiency_reasons)}
  <p>Renewal: ${h.decisions.map(d=>badge(d.decision)+" "+esc(d.decision_notes)).join("; ")||"No decision yet"}</p>`;
  if(s.verification_status==="Returned")html+=`<h3>Correct and resubmit</h3><div class="grid">
  <div><label>GWA<input id="r-gwa" type="number" step="0.01" value="${s.gwa}"></label></div>
  <div><label>Units<input id="r-units" type="number" value="${s.enrolled_units}"></label></div>
  <div><label>Failed<input id="r-failed" type="number" value="${s.failed_count}"></label></div>
  <div><label>INC<input id="r-inc" type="number" value="${s.incomplete_count}"></label></div>
  <div><label>Dropped<input id="r-drop" type="number" value="${s.dropped_count}"></label></div>
  <div><label>Document reference<input id="r-ref" value="${esc(s.evidence_reference)}"></label></div></div>
  <button onclick="doResubmit('${id}')">Resubmit</button>`;
  document.getElementById("detail").innerHTML=html+historyHtml(h);document.getElementById("detail").scrollIntoView({behavior:"smooth"});
}
async function doResubmit(id){
  const g=i=>document.getElementById("r-"+i).value;
  const v={year:"2000-2001",sem:"1",gwa:parseFloat(g("gwa")),units:Number(g("units")),failed:Number(g("failed")),inc:Number(g("inc")),drop:Number(g("drop")),ref:g("ref")};
  const errs=validateSubmission(v);
  if(errs.length)return showMsg("msg",errs.join(" "),"err");
  const {error}=await resubmit(id,v);
  if(error)return showMsg("msg",error.message,"err");
  showMsg("msg","Resubmitted. Status: Pending verification.","ok");await load();detail(id);
}
