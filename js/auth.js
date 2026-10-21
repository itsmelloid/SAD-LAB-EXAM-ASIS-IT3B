async function requireRole(role){
  const {data:{session}}=await db.auth.getSession();
  if(!session){location.href="login.html";return null;}
  const {data:p}=await db.from("profiles").select("*").eq("id",session.user.id).single();
  if(!p){location.href="login.html";return null;}
  if(p.role!==role){location.href=p.role==="staff"?"staff-dashboard.html":"scholar-dashboard.html";return null;}
  return p;
}
async function logout(){await db.auth.signOut();location.href="login.html";}
async function login(e){
  e.preventDefault();
  const email=document.getElementById("email").value.trim(),pw=document.getElementById("password").value;
  if(!email||!pw)return showMsg("msg","Enter your email and password.","err");
  const {data,error}=await db.auth.signInWithPassword({email,password:pw});
  if(error)return showMsg("msg",error.message,"err");
  const {data:p}=await db.from("profiles").select("role").eq("id",data.user.id).single();
  location.href=p?.role==="staff"?"staff-dashboard.html":"scholar-dashboard.html";
}
