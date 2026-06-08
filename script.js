const pageTitle = document.getElementById("pageTitle");
const loginScreen = document.getElementById("loginScreen");
const registerScreen = document.getElementById("registerScreen");
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const loginIdInput = document.getElementById("loginId");
const loginPasswordInput = document.getElementById("loginPassword");
const loginMessage = document.getElementById("loginMessage");
const registerMessage = document.getElementById("registerMessage");
const registrationCompleteMessage = document.getElementById("registrationCompleteMessage");
const showRegisterButton = document.getElementById("showRegisterButton");
const backToLoginButton = document.getElementById("backToLoginButton");
const registerNameInput = document.getElementById("registerName");
const registerEmailInput = document.getElementById("registerEmail");
const registerStaffIdInput = document.getElementById("registerStaffId");
const registerPasswordInput = document.getElementById("registerPassword");
const registerPasswordConfirmInput = document.getElementById("registerPasswordConfirm");
const currentUserLabel = document.getElementById("currentUserLabel");
const logoutButton = document.getElementById("logoutButton");
const staffMonthInput = document.getElementById("staffMonth");
const editStatus = document.getElementById("editStatus");
const monthSelector = document.querySelector(".month-selector");
const tabs = document.querySelectorAll(".tab-button");
const views = document.querySelectorAll(".view");
const shiftForm = document.getElementById("shiftForm");
const changeForm = document.getElementById("changeForm");
const shiftFormTitle = document.getElementById("shiftFormTitle");
const mypageTitle = document.getElementById("mypageTitle");
const staffNameInput = document.getElementById("staffName");
const changeNameInput = document.getElementById("changeName");
const changeDateInput = document.getElementById("changeDate");
const shiftSubmitButton = document.getElementById("shiftSubmitButton");
const changeSubmitButton = document.getElementById("changeSubmitButton");
const changeTypeInputs = document.querySelectorAll('input[name="changeType"]');
const shiftCalendar = document.getElementById("shiftCalendar");
const shiftMessage = document.getElementById("shiftMessage");
const changeMessage = document.getElementById("changeMessage");
const summaryList = document.getElementById("summaryList");
const submissionList = document.getElementById("submissionList");
const mySubmissionList = document.getElementById("mySubmissionList");
const changeList = document.getElementById("changeList");
const adminMonthInput = document.getElementById("adminMonth");
const clearButton = document.getElementById("clearButton");

const storage = {
  shiftKey: "shiftReservations",
  changeKey: "shiftChangeRequests",

  loadShifts() {
    return JSON.parse(localStorage.getItem(this.shiftKey) || "[]");
  },

  saveShifts(items) {
    localStorage.setItem(this.shiftKey, JSON.stringify(items));
  },

  loadChanges() {
    return JSON.parse(localStorage.getItem(this.changeKey) || "[]");
  },

  saveChanges(items) {
    localStorage.setItem(this.changeKey, JSON.stringify(items));
  }
};

const auth = {
  sessionKey: "shiftReservationSession",
  usersKey: "shiftRegisteredStaffUsers",
  adminUser: { id: "admin", name: "管理者", role: "admin", password: "admin123" },

  loadUsers() {
    return JSON.parse(localStorage.getItem(this.usersKey) || "[]");
  },

  saveUsers(users) {
    localStorage.setItem(this.usersKey, JSON.stringify(users));
  },

  isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  },

  register({ name, email, staffId, password, passwordConfirm }) {
    const users = this.loadUsers();
    const cleanStaffId = staffId.trim();

    if (name.trim() === "" || email.trim() === "" || cleanStaffId === "" || password === "") {
      return { ok: false, message: "すべての項目を入力してください。" };
    }

    if (!this.isValidEmail(email.trim())) {
      return { ok: false, message: "メールアドレスの形式が正しくありません。" };
    }

    if (password !== passwordConfirm) {
      return { ok: false, message: "パスワード確認が一致しません。" };
    }

    if (users.some((user) => user.id === cleanStaffId) || this.adminUser.id === cleanStaffId) {
      return { ok: false, message: "このスタッフIDはすでに使われています。" };
    }

    users.push({
      id: cleanStaffId,
      staffId: cleanStaffId,
      name: name.trim(),
      email: email.trim(),
      role: "staff",
      password
    });
    this.saveUsers(users);

    return { ok: true };
  },

  async registerWithSupabase({ name, email, staffId, password, passwordConfirm }) {
    if (name.trim() === "" || email.trim() === "" || staffId.trim() === "" || password === "") {
      return { ok: false, message: "すべての項目を入力してください。" };
    }

    if (!this.isValidEmail(email.trim())) {
      return { ok: false, message: "メールアドレスの形式が正しくありません。" };
    }

    if (password !== passwordConfirm) {
      return { ok: false, message: "パスワード確認が一致しません。" };
    }

    const { data: existingEmail } = await supabaseClient.rpc("get_auth_email_by_staff_id", {
      target_staff_id: staffId.trim()
    });

    if (existingEmail) {
      return { ok: false, message: "このスタッフIDはすでに使われています。" };
    }

    const { data, error } = await supabaseClient.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          display_name: name.trim(),
          staff_id: staffId.trim()
        }
      }
    });

    if (error || !data.user) {
      return { ok: false, message: error ? error.message : "登録に失敗しました。" };
    }

    return { ok: true };
  },

  signIn(loginId, password) {
    const users = [...this.loadUsers(), this.adminUser];
    const user = users.find((item) => item.id === loginId && item.password === password);

    if (!user) {
      return null;
    }

    const session = {
      id: user.id,
      staffId: user.staffId || user.id,
      name: user.name,
      role: user.role,
      email: user.email || ""
    };

    localStorage.setItem(this.sessionKey, JSON.stringify(session));
    return session;
  },

  async signInWithSupabase(loginId, password) {
    let email = loginId.trim();

    if (!email.includes("@")) {
      const { data, error } = await supabaseClient.rpc("get_auth_email_by_staff_id", {
        target_staff_id: email
      });

      if (error || !data) {
        return null;
      }

      email = data;
    }

    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password
    });

    if (error || !data.user) {
      return null;
    }

    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("id, staff_id, display_name, role")
      .eq("id", data.user.id)
      .single();

    return {
      id: data.user.id,
      staffId: profile ? profile.staff_id : "",
      name: profile ? profile.display_name : data.user.email,
      role: profile ? profile.role : "staff",
      email: data.user.email
    };
  },

  getSession() {
    return JSON.parse(localStorage.getItem(this.sessionKey) || "null");
  },

  async getSupabaseSession() {
    const { data } = await supabaseClient.auth.getSession();

    if (!data.session || !data.session.user) {
      return null;
    }

    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("id, staff_id, display_name, role")
      .eq("id", data.session.user.id)
      .single();

    return {
      id: data.session.user.id,
      staffId: profile ? profile.staff_id : "",
      name: profile ? profile.display_name : data.session.user.email,
      role: profile ? profile.role : "staff",
      email: data.session.user.email
    };
  },

  signOut() {
    localStorage.removeItem(this.sessionKey);
  },

  async signOutSupabase() {
    await supabaseClient.auth.signOut();
  }
};

const supabaseSettings = window.shiftAppConfig ? window.shiftAppConfig.supabase : null;
const isSupabaseEnabled = Boolean(
  supabaseSettings &&
  supabaseSettings.enabled &&
  window.supabase &&
  !supabaseSettings.url.includes("YOUR_PROJECT_ID") &&
  (
    (supabaseSettings.publishableKey && !supabaseSettings.publishableKey.includes("YOUR_SUPABASE_PUBLISHABLE_KEY")) ||
    (supabaseSettings.anonKey && !supabaseSettings.anonKey.includes("YOUR_SUPABASE_ANON_KEY"))
  )
);
const supabaseClient = isSupabaseEnabled
  ? window.supabase.createClient(
      supabaseSettings.url,
      supabaseSettings.publishableKey || supabaseSettings.anonKey
    )
  : null;

const dataApi = {
  async loadShifts() {
    if (!isSupabaseEnabled) {
      return storage.loadShifts();
    }

    const { data, error } = await supabaseClient
      .from("shift_submissions")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      return [];
    }

    return data.map((item) => ({
      id: item.id,
      staffId: item.user_id,
      month: getMonthText(monthValueToDate(item.month_value)),
      monthValue: item.month_value,
      name: item.staff_name,
      availableDates: item.available_dates || [],
      offDates: item.off_dates || [],
      dayStatuses: item.day_statuses || {},
      createdAt: new Date(item.created_at).toLocaleString("ja-JP")
    }));
  },

  async saveShift(item) {
    if (!isSupabaseEnabled) {
      shiftSubmissions.push(item);
      storage.saveShifts(shiftSubmissions);
      return true;
    }

    const { error } = await supabaseClient.from("shift_submissions").insert({
      user_id: currentUser.id,
      staff_name: item.name,
      month_value: item.monthValue,
      available_dates: item.availableDates,
      off_dates: item.offDates,
      day_statuses: item.dayStatuses || {}
    });

    if (error) {
      console.error(error);
      return false;
    }

    shiftSubmissions = await this.loadShifts();
    return true;
  },

  async loadChanges() {
    if (!isSupabaseEnabled) {
      return storage.loadChanges();
    }

    const { data, error } = await supabaseClient
      .from("change_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      return [];
    }

    return data.map((item) => ({
      id: item.id,
      staffId: item.user_id,
      name: item.staff_name,
      date: item.target_date,
      changeType: item.change_type,
      createdAt: new Date(item.created_at).toLocaleString("ja-JP")
    }));
  },

  async saveChange(item) {
    if (!isSupabaseEnabled) {
      changeRequests.push(item);
      storage.saveChanges(changeRequests);
      return true;
    }

    const { error } = await supabaseClient.from("change_requests").insert({
      user_id: currentUser.id,
      staff_name: item.name,
      target_date: item.date,
      change_type: item.changeType
    });

    if (error) {
      console.error(error);
      return false;
    }

    changeRequests = await this.loadChanges();
    return true;
  },

  async clearAll() {
    if (!isSupabaseEnabled) {
      shiftSubmissions = [];
      changeRequests = [];
      storage.saveShifts(shiftSubmissions);
      storage.saveChanges(changeRequests);
      return true;
    }

    const { error: shiftError } = await supabaseClient
      .from("shift_submissions")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    const { error: changeError } = await supabaseClient
      .from("change_requests")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");

    if (shiftError || changeError) {
      console.error(shiftError || changeError);
      return false;
    }

    shiftSubmissions = [];
    changeRequests = [];
    return true;
  }
};

let shiftSubmissions = storage.loadShifts();
let changeRequests = storage.loadChanges();
let selectedDayStatuses = {};
let selectedMonth = getDefaultMonthValue();
let adminMonth = selectedMonth;
let currentUser = isSupabaseEnabled ? null : auth.getSession();

function getDefaultMonthValue() {
  const today = new Date();
  return toMonthValue(new Date(today.getFullYear(), today.getMonth() + 1, 1));
}

function getMonthText(date) {
  return `${date.getFullYear()}年${date.getMonth() + 1}月`;
}

function toDateText(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toMonthValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function monthValueToDate(monthValue) {
  const [year, month] = monthValue.split("-").map(Number);
  return new Date(year, month - 1, 1);
}

function getCurrentMonthValue() {
  const today = new Date();
  return toMonthValue(new Date(today.getFullYear(), today.getMonth(), 1));
}

function isPastMonth(monthValue) {
  return monthValue < getCurrentMonthValue();
}

function formatDate(dateText) {
  const [, month, day] = dateText.split("-");
  return `${Number(month)}月${Number(day)}日`;
}

function createId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getTargetDates() {
  const targetMonth = monthValueToDate(selectedMonth);
  const year = targetMonth.getFullYear();
  const month = targetMonth.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  const dates = [];

  for (let day = 1; day <= lastDay; day += 1) {
    dates.push(new Date(year, month, day));
  }

  return dates;
}

function getStatusMark(status) {
  if (status === "available") {
    return "○";
  }

  if (status === "off") {
    return "×";
  }

  return "";
}

function getNextStatus(currentStatus) {
  if (!currentStatus) {
    return "available";
  }

  if (currentStatus === "available") {
    return "off";
  }

  return "";
}

function getDatesByStatus(status) {
  return Object.entries(selectedDayStatuses)
    .filter(([, value]) => value === status)
    .map(([date]) => date)
    .sort();
}

function renderShiftCalendar() {
  shiftCalendar.innerHTML = "";
  const locked = isPastMonth(selectedMonth);

  getTargetDates().forEach((date) => {
    const dateText = toDateText(date);
    const button = document.createElement("button");
    const dayOfWeek = date.getDay();
    const status = selectedDayStatuses[dateText] || "";

    button.type = "button";
    button.className = "day-button";
    button.dataset.date = dateText;
    button.disabled = locked;
    button.setAttribute("aria-label", `${formatDate(dateText)} ${status || "未選択"}`);
    button.innerHTML = `
      <span class="day-number">${date.getDate()}</span>
      <span class="day-state">${getStatusMark(status)}</span>
    `;

    if (dayOfWeek === 0 || dayOfWeek === 6) {
      button.classList.add("weekend");
    }

    if (status) {
      button.classList.add(status);
    }

    shiftCalendar.appendChild(button);
  });
}

function handleDayClick(event) {
  if (isPastMonth(selectedMonth)) {
    return;
  }

  const button = event.target.closest(".day-button");

  if (!button) {
    return;
  }

  const dateText = button.dataset.date;
  const nextStatus = getNextStatus(selectedDayStatuses[dateText]);

  if (nextStatus) {
    selectedDayStatuses[dateText] = nextStatus;
  } else {
    delete selectedDayStatuses[dateText];
  }

  renderShiftCalendar();
}

function renderPickers() {
  renderShiftCalendar();
}

function renderMonthState() {
  const selectedDate = monthValueToDate(selectedMonth);
  const monthText = getMonthText(selectedDate);
  const locked = isPastMonth(selectedMonth);
  const lastDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);

  pageTitle.textContent = `${monthText}分 シフト予約`;
  document.title = `${monthText}分 シフト予約サイト`;
  shiftFormTitle.textContent = `${monthText}分の希望を送信`;
  mypageTitle.textContent = `${monthText}分の自分のシフト希望`;
  staffMonthInput.value = selectedMonth;
  changeDateInput.min = toDateText(selectedDate);
  changeDateInput.max = toDateText(lastDate);

  if (!changeDateInput.value.startsWith(selectedMonth)) {
    changeDateInput.value = toDateText(selectedDate);
  }

  staffNameInput.disabled = locked;
  changeNameInput.disabled = locked;
  changeDateInput.disabled = locked;
  shiftSubmitButton.disabled = locked;
  changeSubmitButton.disabled = locked;
  changeTypeInputs.forEach((input) => {
    input.disabled = locked;
  });

  editStatus.textContent = locked
    ? `${monthText}分は過去月のため、送信・変更申請はできません。`
    : `${monthText}分を編集中です。`;
  editStatus.classList.toggle("locked", locked);

  renderPickers();
}

function switchMonth(monthValue) {
  selectedMonth = monthValue;
  adminMonth = monthValue;
  selectedDayStatuses = {};
  shiftMessage.textContent = "";
  shiftMessage.classList.remove("complete");
  changeMessage.textContent = "";
  changeMessage.classList.remove("complete");
  renderMonthState();
  renderAdmin();
}

function createTags(dates, className = "") {
  if (dates.length === 0) {
    return '<span class="muted">未選択</span>';
  }

  return dates
    .map((date) => `<span class="tag ${className}">${formatDate(date)}</span>`)
    .join("");
}

function createStatusTags(item) {
  if (!item.dayStatuses || Object.keys(item.dayStatuses).length === 0) {
    return `
      <div>
        <p class="muted">出勤可能日</p>
        <div class="tag-list">${createTags(item.availableDates)}</div>
      </div>
      <div>
        <p class="muted">休み希望日</p>
        <div class="tag-list">${createTags(item.offDates, "off")}</div>
      </div>
    `;
  }

  const tags = Object.entries(item.dayStatuses)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, status]) => {
      const mark = status === "available" ? "○" : "×";
      const className = status === "available" ? "" : "off";
      return `<span class="tag ${className}">${formatDate(date)} ${mark}</span>`;
    })
    .join("");

  return `
    <div>
      <p class="muted">回答内容</p>
      <div class="tag-list">${tags || '<span class="muted">未選択</span>'}</div>
    </div>
  `;
}

function renderMySubmissions() {
  if (!currentUser || currentUser.role !== "staff") {
    mySubmissionList.innerHTML = "";
    return;
  }

  const myItems = shiftSubmissions.filter((item) =>
    item.staffId === currentUser.id && item.monthValue === selectedMonth
  );

  if (myItems.length === 0) {
    mySubmissionList.innerHTML = '<p class="empty">この月の送信はまだありません。</p>';
    return;
  }

  mySubmissionList.innerHTML = myItems
    .slice()
    .reverse()
    .map((item) => `
      <article class="submission-card">
        <div class="meta-row">
          <strong>${item.name}</strong>
          <span class="muted">${item.createdAt}</span>
        </div>
        ${createStatusTags(item)}
      </article>
    `)
    .join("");
}

async function submitShift(event) {
  event.preventDefault();

  if (isPastMonth(selectedMonth)) {
    shiftMessage.textContent = "過去月は編集できません。";
    shiftMessage.classList.remove("complete");
    return;
  }

  const name = staffNameInput.value.trim();

  if (name === "") {
    shiftMessage.textContent = "名前を入力してください。";
    shiftMessage.classList.remove("complete");
    return;
  }

  const submission = {
    id: createId(),
    month: getMonthText(monthValueToDate(selectedMonth)),
    monthValue: selectedMonth,
    staffId: currentUser ? currentUser.id : "",
    name,
    availableDates: getDatesByStatus("available"),
    offDates: getDatesByStatus("off"),
    dayStatuses: selectedDayStatuses,
    createdAt: new Date().toLocaleString("ja-JP")
  };

  const saved = await dataApi.saveShift(submission);

  if (!saved) {
    shiftMessage.textContent = "送信に失敗しました。時間をおいて再度お試しください。";
    shiftMessage.classList.remove("complete");
    return;
  }

  selectedDayStatuses = {};
  shiftForm.reset();
  renderPickers();
  renderMySubmissions();
  renderAdmin();
  shiftMessage.textContent = "送信が完了しました。管理者画面の一覧に反映されています。";
  shiftMessage.classList.add("complete");
}

async function submitChange(event) {
  event.preventDefault();

  if (isPastMonth(selectedMonth)) {
    changeMessage.textContent = "過去月は編集できません。";
    changeMessage.classList.remove("complete");
    return;
  }

  const name = changeNameInput.value.trim();
  const date = changeDateInput.value;
  const changeType = document.querySelector('input[name="changeType"]:checked').value;

  if (name === "" || date === "") {
    changeMessage.textContent = "名前と対象日を入力してください。";
    changeMessage.classList.remove("complete");
    return;
  }

  const changeRequest = {
    id: createId(),
    staffId: currentUser ? currentUser.id : "",
    name,
    date,
    changeType,
    createdAt: new Date().toLocaleString("ja-JP")
  };

  const saved = await dataApi.saveChange(changeRequest);

  if (!saved) {
    changeMessage.textContent = "変更申請の送信に失敗しました。時間をおいて再度お試しください。";
    changeMessage.classList.remove("complete");
    return;
  }

  changeForm.reset();
  renderMonthState();
  changeMessage.textContent = "変更申請の送信が完了しました。";
  changeMessage.classList.add("complete");
  renderAdmin();
  renderMySubmissions();
}

function renderSummary() {
  const summaryMonth = monthValueToDate(adminMonth);
  const year = summaryMonth.getFullYear();
  const month = summaryMonth.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  const dates = [];

  for (let day = 1; day <= lastDay; day += 1) {
    dates.push(toDateText(new Date(year, month, day)));
  }

  const summary = dates.map((date) => {
    const availableCount = shiftSubmissions.filter((item) =>
      item.availableDates.includes(date)
    ).length;
    const offCount = shiftSubmissions.filter((item) =>
      item.offDates.includes(date)
    ).length;

    return { date, availableCount, offCount };
  });

  summaryList.innerHTML = summary
    .map((item) => `
      <article class="summary-card">
        <div class="summary-row">
          <strong>${formatDate(item.date)}</strong>
          <span>出勤可能 ${item.availableCount}人 / 休み希望 ${item.offCount}人</span>
        </div>
      </article>
    `)
    .join("");
}

function renderSubmissions() {
  const filteredSubmissions = shiftSubmissions.filter((item) =>
    item.monthValue ? item.monthValue === adminMonth : item.month === getMonthText(monthValueToDate(adminMonth))
  );

  if (filteredSubmissions.length === 0) {
    submissionList.innerHTML = '<p class="empty">まだ送信がありません。</p>';
    return;
  }

  submissionList.innerHTML = filteredSubmissions
    .slice()
    .reverse()
    .map((item) => `
      <article class="submission-card">
        <div class="meta-row">
          <strong>${item.name}</strong>
          <span class="muted">${item.createdAt}</span>
        </div>
        <p class="muted">${item.month}</p>
        ${createStatusTags(item)}
      </article>
    `)
    .join("");
}

function renderChanges() {
  const filteredChanges = changeRequests.filter((item) => item.date.startsWith(adminMonth));

  if (filteredChanges.length === 0) {
    changeList.innerHTML = '<p class="empty">まだ変更申請がありません。</p>';
    return;
  }

  changeList.innerHTML = filteredChanges
    .slice()
    .reverse()
    .map((item) => `
      <article class="submission-card">
        <div class="meta-row">
          <strong>${item.name}</strong>
          <span class="muted">${item.createdAt}</span>
        </div>
        <div class="summary-row">
          <span>${formatDate(item.date)}</span>
          <strong>${item.changeType}</strong>
        </div>
      </article>
    `)
    .join("");
}

function renderAdmin() {
  adminMonthInput.value = adminMonth;
  renderSummary();
  renderSubmissions();
  renderChanges();
}

function switchView(viewId) {
  tabs.forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.view === viewId);
  });

  views.forEach((view) => {
    view.classList.toggle("active", view.id === viewId);
  });

  if (viewId === "adminView") {
    renderAdmin();
  }
}

async function applySession() {
  if (!currentUser) {
    loginScreen.classList.remove("hidden");
    registerScreen.classList.add("hidden");
    document.querySelector(".app").classList.add("hidden");
    staffNameInput.readOnly = false;
    changeNameInput.readOnly = false;
    return;
  }

  loginScreen.classList.add("hidden");
  document.querySelector(".app").classList.remove("hidden");
  currentUserLabel.textContent = `${currentUser.name}（${currentUser.role === "admin" ? "管理者" : "スタッフ"}）`;
  shiftSubmissions = await dataApi.loadShifts();
  changeRequests = await dataApi.loadChanges();

  if (currentUser.role === "admin") {
    monthSelector.classList.add("admin-only");
    staffNameInput.readOnly = false;
    changeNameInput.readOnly = false;
    tabs.forEach((tab) => {
      tab.style.display = tab.dataset.view === "adminView" ? "block" : "none";
    });
    switchView("adminView");
  } else {
    monthSelector.classList.remove("admin-only");
    tabs.forEach((tab) => {
      tab.style.display = tab.dataset.view === "adminView" ? "none" : "block";
    });
    staffNameInput.value = currentUser.name;
    staffNameInput.readOnly = true;
    changeNameInput.value = currentUser.name;
    changeNameInput.readOnly = true;
    switchView("staffView");
  }

  renderMonthState();
  renderMySubmissions();
  renderAdmin();
}

function showLoginScreen({ registered = false } = {}) {
  registerScreen.classList.add("hidden");
  loginScreen.classList.remove("hidden");
  registerMessage.textContent = "";
  loginMessage.textContent = "";
  registrationCompleteMessage.classList.toggle("hidden", !registered);
}

function showRegisterScreen() {
  loginScreen.classList.add("hidden");
  registerScreen.classList.remove("hidden");
  registrationCompleteMessage.classList.add("hidden");
  registerMessage.textContent = "";
}

tabs.forEach((tab) => {
  tab.addEventListener("click", () => switchView(tab.dataset.view));
});

shiftCalendar.addEventListener("click", handleDayClick);
shiftForm.addEventListener("submit", submitShift);
changeForm.addEventListener("submit", submitChange);

adminMonthInput.addEventListener("change", () => {
  if (adminMonthInput.value === "") {
    return;
  }

  adminMonth = adminMonthInput.value;
  renderAdmin();
});

staffMonthInput.addEventListener("change", () => {
  if (staffMonthInput.value === "") {
    return;
  }

  switchMonth(staffMonthInput.value);
});

clearButton.addEventListener("click", async () => {
  const canClear = confirm("保存されている送信内容と変更申請をすべて削除しますか？");

  if (!canClear) {
    return;
  }

  const cleared = await dataApi.clearAll();

  if (!cleared) {
    alert("削除に失敗しました。権限またはSupabase設定を確認してください。");
    return;
  }

  renderAdmin();
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const session = isSupabaseEnabled
    ? await auth.signInWithSupabase(loginIdInput.value.trim(), loginPasswordInput.value)
    : auth.signIn(loginIdInput.value.trim(), loginPasswordInput.value);

  if (!session) {
    loginMessage.textContent = "ログイン情報が違います。";
    return;
  }

  currentUser = session;
  loginMessage.textContent = "";
  loginForm.reset();
  await applySession();
});

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formValues = {
    name: registerNameInput.value,
    email: registerEmailInput.value,
    staffId: registerStaffIdInput.value,
    password: registerPasswordInput.value,
    passwordConfirm: registerPasswordConfirmInput.value
  };
  const result = isSupabaseEnabled
    ? await auth.registerWithSupabase(formValues)
    : auth.register(formValues);

  if (!result.ok) {
    registerMessage.textContent = result.message;
    return;
  }

  registerForm.reset();
  showLoginScreen({ registered: true });
});

showRegisterButton.addEventListener("click", showRegisterScreen);
backToLoginButton.addEventListener("click", () => showLoginScreen());

logoutButton.addEventListener("click", async () => {
  if (isSupabaseEnabled) {
    await auth.signOutSupabase();
  }

  auth.signOut();
  currentUser = null;
  await applySession();
});

async function initApp() {
  if (isSupabaseEnabled) {
    currentUser = await auth.getSupabaseSession();
  }

  adminMonthInput.value = adminMonth;
  staffMonthInput.value = selectedMonth;
  renderMonthState();
  renderAdmin();
  await applySession();
}

initApp();
