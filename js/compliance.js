// Evaluation runs in the database (evaluate_compliance) using thresholds from scholarship_programs.
async function evaluate(id){return db.rpc("evaluate_compliance",{p_id:id});}
function checksHtml(checks){
  if(!checks)return "<p>Not evaluated yet.</p>";
  return `<h3>Policy checks</h3><div class="wrap"><table><tr><th>Check</th><th>Result</th><th>Detail</th></tr>${
    checks.map(c=>`<tr><td>${esc(c.check)}</td><td>${c.ok?'<span class="Verified">Pass</span>':'<span class="Returned">Fail</span>'}</td><td>${esc(c.detail)}</td></tr>`).join("")}</table></div>`;
}
