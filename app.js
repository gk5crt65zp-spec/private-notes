/* =====================================================
 * دفتر الملاحظات الخاص — Private Notes
 * Supabase Auth + RLS
 * ===================================================== */

const $ = (id) => document.getElementById(id);

// ---------- عناصر الواجهة ----------
const setupWarning = $("setup-warning");
const authView = $("auth-view");
const appView = $("app-view");
const userBox = $("user-box");
const userEmail = $("user-email");

const tabLogin = $("tab-login");
const tabSignup = $("tab-signup");
const authForm = $("auth-form");
const authSubmit = $("auth-submit");
const authError = $("auth-error");
const authInfo = $("auth-info");

const noteForm = $("note-form");
const noteId = $("note-id");
const noteTitle = $("note-title");
const noteCategory = $("note-category");
const noteContent = $("note-content");
const formTitle = $("form-title");
const cancelEdit = $("cancel-edit");
const notesList = $("notes-list");
const notesCount = $("notes-count");
const emptyState = $("empty-state");
const searchInput = $("search");
const logoutBtn = $("logout-btn");

// ---------- تهيئة Supabase ----------
let db = null; // عميل Supabase — تجنّبنا لتسمية `supabase` لأن المكتبة تستخدمها كمتغيّر عام
let mode = "login"; // login | signup
let notes = [];

const PLACEHOLDER_RE = /YOUR_PROJECT_REF|YOUR_ANON/;
const STORAGE_KEY = "private_notes_supabase_config";

function readStoredConfig() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
  } catch {
    return null;
  }
}

function resolveConfig() {
  // الأولوية لقيم config.js إن كانت حقيقية، ثم للقيم المحفوظة في المتصفح
  const stored = readStoredConfig() || {};
  const url = PLACEHOLDER_RE.test(SUPABASE_URL) ? stored.url : SUPABASE_URL;
  const key = PLACEHOLDER_RE.test(SUPABASE_ANON_KEY) ? stored.key : SUPABASE_ANON_KEY;
  return {
    url: typeof url === "string" && url.startsWith("http") ? url.trim() : null,
    key: typeof key === "string" && key.length > 30 ? key.trim() : null,
  };
}

function initSupabaseClient() {
  const cfg = resolveConfig();
  if (cfg.url && cfg.key) {
    db = window.supabase.createClient(cfg.url, cfg.key);
    setupWarning.classList.add("hidden");
    return true;
  }
  db = null;
  setupWarning.classList.remove("hidden");
  return false;
}

initSupabaseClient();

// ---------- نافذة الإعدادات ----------
const settingsModal = $("settings-modal");
const cfgUrl = $("cfg-url");
const cfgKey = $("cfg-key");

function openSettings() {
  const cfg = resolveConfig();
  cfgUrl.value = cfg.url || "";
  cfgKey.value = cfg.key || "";
  settingsModal.classList.remove("hidden");
}
function closeSettings() {
  settingsModal.classList.add("hidden");
}

$("settings-btn").addEventListener("click", openSettings);
$("banner-settings-btn").addEventListener("click", openSettings);
$("cfg-close").addEventListener("click", closeSettings);
settingsModal.addEventListener("click", (e) => {
  if (e.target === settingsModal) closeSettings();
});

$("cfg-save").addEventListener("click", () => {
  const url = cfgUrl.value.trim().replace(/\/+$/, "");
  const key = cfgKey.value.trim();
  if (!/^https?:\/\//.test(url)) return alert("رابط المشروع غير صحيح — يجب أن يبدأ بـ https://");
  if (key.length < 30) return alert("مفتاح anon قصير جدًا — تأكد من نسخه كاملاً.");
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ url, key }));
  location.reload();
});

$("cfg-clear").addEventListener("click", () => {
  localStorage.removeItem(STORAGE_KEY);
  location.reload();
});

function showError(el, msg) {
  el.textContent = msg;
  el.classList.remove("hidden");
}
function hide(el) {
  el.classList.add("hidden");
}
function authMsg(error, info) {
  hide(authError);
  hide(authInfo);
  if (error) showError(authError, translateError(error));
  if (info) showError(authInfo, info);
}
// ترجمة رسائل الخطأ الشائعة إلى العربية
function translateError(error) {
  const m = (error && error.message) || String(error);
  if (/Invalid login credentials/i.test(m)) return "بيانات الدخول غير صحيحة (بريد أو كلمة مرور).";
  if (/User already registered/i.test(m)) return "هذا البريد مسجّل مسبقًا، سجّل الدخول.";
  if (/Password should be at least/i.test(m)) return "كلمة المرور قصيرة (6 أحرف على الأقل).";
  if (/Email not confirmed/i.test(m)) return "لم يتم تأكيد البريد بعد — تحقق من بريدك الإلكتروني.";
  if (/Failed to fetch/i.test(m)) return "تعذّر الاتصال بخادم Supabase — تحقق من الإعدادات (⚙️) أو من اتصال الإنترنت.";
  return "خطأ: " + m;
}

// ---------- التبديل بين تبويبات الدخول ----------
function setMode(next) {
  mode = next;
  tabLogin.classList.toggle("active", next === "login");
  tabSignup.classList.toggle("active", next === "signup");
  authSubmit.textContent = next === "login" ? "دخول" : "إنشاء الحساب";
  authMsg(null, null);
}
tabLogin.addEventListener("click", () => setMode("login"));
tabSignup.addEventListener("click", () => setMode("signup"));

// ---------- المصادقة ----------
authForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!db) return;
  const email = $("auth-email").value.trim();
  const password = $("auth-password").value;
  authMsg(null, "جارٍ التنفيذ...");

  try {
    if (mode === "signup") {
      const { data, error } = await db.auth.signUp({ email, password });
      if (error) throw error;
      if (data.session) {
        authMsg(null, "تم إنشاء الحساب بنجاح ✅");
        onSignedIn(data.user);
      } else {
        authMsg(null, "تم إنشاء الحساب! تحقق من بريدك لتأكيد الحساب ثم سجّل الدخول.");
      }
    } else {
      const { data, error } = await db.auth.signInWithPassword({ email, password });
      if (error) throw error;
      authMsg(null, null);
      onSignedIn(data.user);
    }
  } catch (err) {
    authMsg(err, null);
  }
});

logoutBtn.addEventListener("click", async () => {
  if (!db) return;
  await db.auth.signOut();
  onSignedOut();
});

function onSignedIn(user) {
  hide(authView);
  appView.classList.remove("hidden");
  userBox.classList.remove("hidden");
  userEmail.textContent = user.email;
  loadNotes();
}

function onSignedOut() {
  hide(appView);
  hide(userBox);
  authView.classList.remove("hidden");
  authForm.reset();
  notes = [];
  renderNotes();
}

// ---------- تحميل ملاحظات المستخدم الحالي ----------
// ملاحظة مهمة: الـ RLS يضمن أن الاستعلام لا يعيد إلا ملاحظات هذا المستخدم
async function loadNotes() {
  if (!db) return;
  const { data, error } = await db
    .from("notes")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) {
    notesCount.textContent = "تعذّر تحميل الملاحظات: " + translateError(error);
    return;
  }
  notes = data || [];
  renderNotes();
}

// ---------- حفظ ملاحظة (إضافة أو تعديل) ----------
noteForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!db) return;

  const { data: { user } } = await db.auth.getUser();
  if (!user) return;

  const payload = {
    title: noteTitle.value.trim(),
    category: noteCategory.value.trim() || "عام",
    content: noteContent.value,
    user_id: user.id, // RLS يتحقق: user_id يجب أن يساوي auth.uid()
  };

  let error;
  if (noteId.value) {
    ({ error } = await db.from("notes").update(payload).eq("id", noteId.value));
  } else {
    ({ error } = await db.from("notes").insert(payload));
  }

  if (error) {
    alert(translateError(error));
    return;
  }
  resetForm();
  await loadNotes();
});

function resetForm() {
  noteForm.reset();
  noteId.value = "";
  formTitle.textContent = "➕ ملاحظة جديدة";
  cancelEdit.classList.add("hidden");
}

cancelEdit.addEventListener("click", resetForm);

// ---------- عرض الملاحظات ----------
function renderNotes() {
  const q = searchInput.value.trim().toLowerCase();
  const filtered = notes.filter(
    (n) =>
      !q ||
      n.title.toLowerCase().includes(q) ||
      n.content.toLowerCase().includes(q) ||
      (n.category || "").toLowerCase().includes(q)
  );

  notesList.innerHTML = "";
  emptyState.classList.toggle("hidden", filtered.length > 0);
  notesCount.textContent = filtered.length
    ? `عدد الملاحظات: ${filtered.length} — مرئية لك فقط بسبب RLS 🔒`
    : "";

  for (const n of filtered) {
    const card = document.createElement("article");
    card.className = "note";

    const h3 = document.createElement("h3");
    h3.textContent = n.title;

    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = n.category || "عام";

    const p = document.createElement("p");
    p.className = "content";
    p.textContent = n.content;

    const meta = document.createElement("div");
    meta.className = "meta";

    const date = document.createElement("span");
    date.textContent = new Date(n.updated_at).toLocaleString("ar", {
      dateStyle: "medium",
      timeStyle: "short",
    });

    const tools = document.createElement("div");
    tools.className = "tools";

    const editBtn = document.createElement("button");
    editBtn.className = "icon-btn";
    editBtn.textContent = "✏️ تعديل";
    editBtn.addEventListener("click", () => {
      noteId.value = n.id;
      noteTitle.value = n.title;
      noteCategory.value = n.category || "";
      noteContent.value = n.content || "";
      formTitle.textContent = "✏️ تعديل ملاحظة";
      cancelEdit.classList.remove("hidden");
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    const delBtn = document.createElement("button");
    delBtn.className = "icon-btn danger";
    delBtn.textContent = "🗑️ حذف";
    delBtn.addEventListener("click", async () => {
      if (!confirm(`حذف ملاحظة "${n.title}"؟`)) return;
      const { error } = await db.from("notes").delete().eq("id", n.id);
      if (error) return alert(translateError(error));
      if (noteId.value === n.id) resetForm();
      await loadNotes();
    });

    tools.append(editBtn, delBtn);
    meta.append(date, tools);

    card.append(h3, badge, p, meta);
    notesList.appendChild(card);
  }
}

searchInput.addEventListener("input", renderNotes);

// ---------- جلسة مستمرة ----------
(async function init() {
  if (!db) {
    authView.classList.remove("hidden");
    return;
  }
  const { data: { session } } = await db.auth.getSession();
  if (session && session.user) {
    onSignedIn(session.user);
  } else {
    authView.classList.remove("hidden");
  }

  db.auth.onAuthStateChange((_event, session) => {
    if (session && session.user) {
      onSignedIn(session.user);
    } else {
      onSignedOut();
    }
  });
})();
