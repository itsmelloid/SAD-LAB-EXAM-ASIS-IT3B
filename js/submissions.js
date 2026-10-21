const SUB_SELECT="*, profiles(full_name,student_id), scholarship_programs(name)";
async function createSubmission(v){
  return db.rpc("submit_semester",{p_year:v.year,p_sem:v.sem,p_gwa:v.gwa,p_units:v.units,p_failed:v.failed,p_inc:v.inc,p_drop:v.drop,p_ref:v.ref});
}
async function resubmit(id,v){
  return db.rpc("resubmit_semester",{p_id:id,p_gwa:v.gwa,p_units:v.units,p_failed:v.failed,p_inc:v.inc,p_drop:v.drop,p_ref:v.ref});
}
async function loadHistory(id){
  const [a,d]=await Promise.all([
    db.from("audit_logs").select("*, profiles(full_name)").eq("submission_id",id).order("created_at"),
    db.from("renewal_decisions").select("*, profiles(full_name)").eq("submission_id",id).order("decided_at")]);
  return {logs:a.data||[],decisions:d.data||[]};
}
function pht(t){return new Date(t).toLocaleString("en-PH",{timeZone:"Asia/Manila"});}
function historyHtml(h){
  const rows=h.logs.map(l=>`<tr><td>${pht(l.created_at)}</td><td>${esc(l.profiles?.full_name)}</td><td>${esc(l.action)}</td><td>${esc(l.details)}</td></tr>`).join("");
  return `<h3>History</h3><div class="wrap"><table><tr><th>When (PHT)</th><th>By</th><th>Action</th><th>Notes</th></tr>${rows||"<tr><td colspan=4>No history yet.</td></tr>"}</table></div>`;
}
