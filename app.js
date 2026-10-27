// MEM College starter. Set these two values from Supabase > Project Settings > API.
const SUPABASE_URL = "https://hpvjerfqkduiyadagggi.supabase.co";
const SUPABASE_ANON_KEY = "
sb_publishable_tb-G3ZmFLvCB157U7Mot8g_QmYvlrX0";
const configured = !SUPABASE_URL.includes("PASTE_") && !SUPABASE_ANON_KEY.includes("PASTE_");
const db = configured ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const $ = id => document.getElementById(id);
let sessionUser = null;
let profile = null;

const roleNames = { student: "طالب", teacher: "تدريسي", admin: "مدير" };
const deptNames = { CS: "علوم الحاسوب", SWE: "هندسة البرمجيات", CYBER: "الأمن السيبراني", AI: "الذكاء الاصطناعي" };

function message(text, isError = false) {
  $("appMessage").textContent = text;
  $("appMessage").className = `text-sm ${isError ? "text-red-300" : "text-emerald-300"}`;
}
function authMessage(text) { $("authMessage").textContent = text; }
function show(id, yes = true) { $(id).classList.toggle("hidden", !yes); }
function hideAllDashboards() {
  ["studentPanel", "teacherPanel", "adminPanel", "pendingPanel"].forEach(id => show(id, false));
}
function setAuthMode(mode) {
  show("loginForm", mode === "login");
  show("registerForm", mode === "register");
  $("showLogin").className = `rounded-lg p-2 font-bold ${mode === "login" ? "bg-indigo-600" : "bg-slate-800"}`;
  $("showRegister").className = `rounded-lg p-2 font-bold ${mode === "register" ? "bg-indigo-600" : "bg-slate-800"}`;
}
$("showLogin").addEventListener("click", () => setAuthMode("login"));
$("showRegister").addEventListener("click", () => setAuthMode("register"));

async function loadProfile(user) {
  const { data, error } = await db.from("profiles").select("id, full_name, role, approved").eq("id", user.id).single();
  if (error) throw error;
  return data;
}
async function refreshUI() {
  hideAllDashboards();
  if (!sessionUser || !profile) {
    show("authPanel");
    show("navUser", false);
    return;
  }
  show("authPanel", false);
  show("navUser");
  $("navName").textContent = `${profile.full_name} — ${roleNames[profile.role] || profile.role}`;
  if (profile.role === "admin") {
    show("adminPanel");
    await loadAdminData();
  } else if (profile.role === "teacher" && profile.approved) {
    show("teacherPanel");
  } else if (profile.role === "teacher") {
    show("pendingPanel");
  } else {
    show("studentPanel");
    await loadLectures();
  }
}
$("loginForm").addEventListener("submit", async e => {
  e.preventDefault();
  if (!db) return authMessage("أكمل إعداد Supabase داخل app.js أولاً.");
  authMessage("جارٍ تسجيل الدخول...");
  const { data, error } = await db.auth.signInWithPassword({ email: $("loginEmail").value.trim(), password: $("loginPassword").value });
  if (error) return authMessage(error.message);
  sessionUser = data.user;
  try { profile = await loadProfile(sessionUser); await refreshUI(); authMessage(""); }
  catch (err) { authMessage("تعذر تحميل الملف الشخصي. تأكد من تشغيل SQL وإعداد الصلاحيات."); console.error(err); }
});
$("registerForm").addEventListener("submit", async e => {
  e.preventDefault();
  if (!db) return authMessage("أكمل إعداد Supabase داخل app.js أولاً.");
  const full_name = $("regName").value.trim();
  const email = $("regEmail").value.trim();
  const password = $("regPassword").value;
  const role = $("regRole").value;
  if (full_name.length < 2) return authMessage("اكتب الاسم الكامل.");
  authMessage("جارٍ إنشاء الحساب...");
  const { data, error } = await db.auth.signUp({ email, password, options: { data: { full_name, requested_role: role } } });
  if (error) return authMessage(error.message);
  if (!data.session) authMessage("تحقق من بريدك الإلكتروني لتفعيل الحساب، ثم سجّل الدخول.");
  else authMessage("تم إنشاء الحساب. حساب التدريسي ينتظر اعتماد المدير.");
});
$("logoutBtn").addEventListener("click", async () => {
  if (db) await db.auth.signOut();
  sessionUser = null; profile = null; hideAllDashboards(); show("authPanel"); show("navUser", false); message("تم تسجيل الخروج.");
});

async function loadLectures() {
  const dept = $("studentDept").value, stage = Number($("studentStage").value);
  const box = $("lectureList");
  box.replaceChildren();
  const { data, error } = await db.from("lectures").select("id,title,instructions,department,stage,teacher_name,created_at").eq("department", dept).eq("stage", stage).order("created_at", { ascending: false });
  if (error) return message("تعذر تحميل الملازم: " + error.message, true);
  if (!data.length) { box.textContent = "لا توجد ملازم منشورة لهذا القسم والمرحلة حالياً."; return; }
  for (const item of data) {
    const card = document.createElement("article");
    card.className = "rounded-xl border border-slate-800 bg-slate-900 p-5";
    const title = document.createElement("h3"); title.className = "mb-2 text-lg font-bold text-indigo-300"; title.textContent = item.title;
    const teacher = document.createElement("p"); teacher.className = "mb-3 text-xs text-slate-400"; teacher.textContent = `التدريسي: ${item.teacher_name || "غير محدد"} — ${deptNames[item.department] || item.department} — المرحلة ${item.stage}`;
    const instructions = document.createElement("p"); instructions.className = "mb-4 whitespace-pre-wrap text-sm text-slate-300"; instructions.textContent = item.instructions || "لا توجد تعليمات إضافية.";
    const link = document.createElement("button"); link.className = "rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold"; link.textContent = "فتح / تنزيل PDF";
    link.addEventListener("click", async () => {
      const { data: signed, error: signedError } = await db.storage.from("lecture-pdfs").createSignedUrl(item.storage_path, 120);
      if (signedError) return message("تعذر فتح الملف: " + signedError.message, true);
      window.open(signed.signedUrl, "_blank", "noopener,noreferrer");
    });
    card.append(title, teacher, instructions, link);
    box.append(card);
  }
}
$("searchLectures").addEventListener("click", loadLectures);

$("uploadForm").addEventListener("submit", async e => {
  e.preventDefault();
  if (!sessionUser || profile?.role !== "teacher" || !profile.approved) return message("هذا الإجراء متاح للتدريسي المعتمد فقط.", true);
  const file = $("uploadFile").files[0];
  if (!file) return message("اختر ملف PDF.", true);
  if (file.type !== "application/pdf" || !file.name.toLowerCase().endsWith(".pdf")) return message("يُسمح بملفات PDF فقط.", true);
  if (file.size > 15 * 1024 * 1024) return message("حجم الملف أكبر من 15 MB.", true);
  const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${sessionUser.id}/${crypto.randomUUID()}-${cleanName}`;
  message("جارٍ رفع الملف...");
  const { error: uploadError } = await db.storage.from("lecture-pdfs").upload(path, file, { contentType: "application/pdf", upsert: false });
  if (uploadError) return message("فشل رفع الملف: " + uploadError.message, true);
  const payload = {
    title: $("uploadTitle").value.trim(),
    department: $("uploadDept").value,
    stage: Number($("uploadStage").value),
    instructions: $("uploadInstructions").value.trim(),
    storage_path: path,
    teacher_id: sessionUser.id,
    teacher_name: profile.full_name
  };
  const { error } = await db.from("lectures").insert(payload);
  if (error) {
    await db.storage.from("lecture-pdfs").remove([path]);
    return message("تم إلغاء النشر بسبب خطأ في قاعدة البيانات: " + error.message, true);
  }
  $("uploadForm").reset();
  message("تم رفع الملزمة ونشرها.");
});
$("noteForm").addEventListener("submit", async e => {
  e.preventDefault();
  if (!sessionUser || profile?.role !== "teacher" || !profile.approved) return message("هذا الإجراء متاح للتدريسي المعتمد فقط.", true);
  const { error } = await db.from("teacher_notes").insert({
    title: $("noteTitle").value.trim(), body: $("noteBody").value.trim(),
    department: $("noteDept").value, stage: Number($("noteStage").value),
    teacher_id: sessionUser.id, teacher_name: profile.full_name
  });
  if (error) return message("تعذر نشر الملاحظة: " + error.message, true);
  $("noteForm").reset(); message("تم نشر الملاحظة.");
});
$("sendReport").addEventListener("click", async () => {
  const body = $("reportBody").value.trim();
  if (!body) return message("اكتب تفاصيل البلاغ أولاً.", true);
  const { error } = await db.from("reports").insert({ student_id: sessionUser.id, student_name: profile.full_name, body });
  if (error) return message("تعذر إرسال البلاغ: " + error.message, true);
  $("reportBody").value = ""; message("تم إرسال البلاغ إلى الإدارة.");
});

async function loadAdminData() {
  const [teachersRes, reportsRes] = await Promise.all([
    db.from("profiles").select("id,full_name,created_at").eq("role", "teacher").eq("approved", false).order("created_at"),
    db.from("reports").select("id,student_name,body,created_at,status").order("created_at", { ascending: false })
  ]);
  const teachersBox = $("pendingTeachers"); teachersBox.replaceChildren();
  if (teachersRes.error) teachersBox.textContent = "تعذر تحميل الحسابات: " + teachersRes.error.message;
  else if (!teachersRes.data.length) teachersBox.textContent = "لا توجد طلبات اعتماد حالياً.";
  else teachersRes.data.forEach(t => {
    const row = document.createElement("div"); row.className = "flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-950 p-3";
    const name = document.createElement("span"); name.textContent = t.full_name;
    const btn = document.createElement("button"); btn.className = "rounded-lg bg-emerald-600 px-3 py-2"; btn.textContent = "اعتماد التدريسي";
    btn.addEventListener("click", async () => {
      const { error } = await db.rpc("approve_teacher", { target_user_id: t.id });
      if (error) return message("تعذر الاعتماد: " + error.message, true);
      message("تم اعتماد التدريسي."); await loadAdminData();
    });
    row.append(name, btn); teachersBox.append(row);
  });
  const reportsBox = $("adminReports"); reportsBox.replaceChildren();
  if (reportsRes.error) reportsBox.textContent = "تعذر تحميل البلاغات: " + reportsRes.error.message;
  else if (!reportsRes.data.length) reportsBox.textContent = "لا توجد بلاغات.";
  else reportsRes.data.forEach(r => {
    const row = document.createElement("article"); row.className = "rounded-lg bg-slate-950 p-3";
    const heading = document.createElement("div"); heading.className = "mb-2 text-sm font-bold text-amber-200"; heading.textContent = `${r.student_name} — ${new Date(r.created_at).toLocaleString("ar-IQ")} — ${r.status}`;
    const body = document.createElement("p"); body.className = "whitespace-pre-wrap text-sm"; body.textContent = r.body;
    row.append(heading, body); reportsBox.append(row);
  });
}

async function boot() {
  if (!configured) { show("setupWarning"); return; }
  const { data: { session } } = await db.auth.getSession();
  if (session) {
    sessionUser = session.user;
    try { profile = await loadProfile(sessionUser); await refreshUI(); }
    catch (e) { console.error(e); message("تعذر تحميل بيانات الحساب. راجع إعداد قاعدة البيانات.", true); }
  }
  db.auth.onAuthStateChange(async (_event, session) => {
    if (!session) { sessionUser = null; profile = null; await refreshUI(); return; }
    sessionUser = session.user;
    try { profile = await loadProfile(sessionUser); await refreshUI(); }
    catch (e) { console.error(e); }
  });
}
boot();
