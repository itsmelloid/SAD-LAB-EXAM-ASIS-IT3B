function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function badge(t){return `<span class="badge ${esc(String(t).replace(/ /g,"-"))}">${esc(t)}</span>`;}
function showMsg(id,text,type){const e=document.getElementById(id);e.textContent=text;e.className="msg "+type;}
function validateSubmission(v){
  const errs=[];
  if(!/^\d{4}-\d{4}$/.test(v.year))errs.push("Academic year must look like 2026-2027.");
  if(!["1","2","Summer"].includes(v.sem))errs.push("Choose a semester.");
  if(!(v.gwa>=1&&v.gwa<=5))errs.push("GWA must be between 1.00 and 5.00.");
  for(const [k,n] of [["units","Enrolled units"],["failed","Failed subjects"],["inc","Incomplete grades"],["drop","Dropped subjects"]])
    if(!Number.isInteger(v[k])||v[k]<0)errs.push(n+" must be a whole number, 0 or higher.");
  if(!v.ref.trim())errs.push("Grade-document reference is required.");
  return errs;
}
