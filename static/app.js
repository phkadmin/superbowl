const STORAGE_KEY = "sb_betting_draft_v1";

const state = {
  questions: [],
  answers: {},
  adminPassword: "",
  previousView: "survey",
  mySubmission: null,
};

const el = {
  tallyPill: document.getElementById("tallyPill"),
  views: {
    survey: document.getElementById("surveyView"),
    summary: document.getElementById("summaryView"),
    venmo: document.getElementById("venmoView"),
    results: document.getElementById("resultsView"),
    adminLogin: document.getElementById("adminLoginView"),
    admin: document.getElementById("adminView"),
    viewGuessesAccess: document.getElementById("viewGuessesAccessView"),
  },
  questionsContainer: document.getElementById("questionsContainer"),
  summaryStats: document.getElementById("summaryStats"),
  resultMeta: document.getElementById("resultMeta"),
  resultsContainer: document.getElementById("resultsContainer"),
  myGuessesCard: document.getElementById("myGuessesCard"),
  adminAnswersContainer: document.getElementById("adminAnswersContainer"),
  adminTotals: document.getElementById("adminTotals"),
  adminByPerson: document.getElementById("adminByPerson"),
  adminByQuestion: document.getElementById("adminByQuestion"),
  adminLoginError: document.getElementById("adminLoginError"),
  lookupError: document.getElementById("lookupError"),
  fullName: document.getElementById("fullName"),
  venmoHandle: document.getElementById("venmoHandle"),
  phoneNumber: document.getElementById("phoneNumber"),
  lookupLast4: document.getElementById("lookupLast4"),
};

const questionTemplate = document.getElementById("questionCardTemplate");

function activeViewName() {
  return Object.keys(el.views).find((key) => el.views[key].classList.contains("active")) || "survey";
}

function showView(name) {
  Object.values(el.views).forEach((v) => v.classList.remove("active"));
  el.views[name].classList.add("active");
}

function formatDollars(num) {
  return `$${Number(num).toFixed(2).replace(/\.00$/, "")}`;
}

function statsTile(label, value) {
  return `
    <div class="stat">
      <div class="label">${label}</div>
      <div class="value">${value}</div>
    </div>
  `;
}

function saveDraft() {
  const payload = {
    fullName: el.fullName.value.trim(),
    venmoHandle: el.venmoHandle.value.trim(),
    phoneNumber: el.phoneNumber.value.trim(),
    answers: state.answers,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function restoreDraft() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return;
  }
  try {
    const payload = JSON.parse(raw);
    state.answers = payload.answers && typeof payload.answers === "object" ? payload.answers : {};
    el.fullName.value = payload.fullName || "";
    el.venmoHandle.value = payload.venmoHandle || "";
    el.phoneNumber.value = payload.phoneNumber || "";
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function clearDraft() {
  localStorage.removeItem(STORAGE_KEY);
}

function getSummary() {
  const answered = state.questions.filter((q) => state.answers[String(q.id)] !== undefined && state.answers[String(q.id)] !== "");
  const total = answered.reduce((sum, q) => sum + q.cost, 0);
  return { answeredCount: answered.length, total };
}

function updateTally() {
  const { total } = getSummary();
  el.tallyPill.textContent = `${formatDollars(total)} owed`;
}

function syncQuestionUI(questionId) {
  const qid = String(questionId);
  const value = state.answers[qid];

  const clearBtn = document.querySelector(`[data-clear-for="${qid}"]`);
  if (clearBtn) {
    clearBtn.disabled = value === undefined || value === "";
  }

  const input = document.querySelector(`[data-numeric-for="${qid}"]`);
  if (input) {
    input.value = value || "";
  }

  document.querySelectorAll(`[data-option-for="${qid}"]`).forEach((card) => {
    card.classList.toggle("selected", card.dataset.optionValue === value);
  });
}

function setAnswer(questionId, value) {
  if (value === "" || value === null || value === undefined) {
    delete state.answers[String(questionId)];
  } else {
    state.answers[String(questionId)] = value;
  }
  syncQuestionUI(questionId);
  updateTally();
  saveDraft();
}

function renderQuestions() {
  el.questionsContainer.innerHTML = "";

  state.questions.forEach((q) => {
    const node = questionTemplate.content.firstElementChild.cloneNode(true);
    node.querySelector("h3").textContent = `${q.id}. ${q.text}`;
    node.querySelector(".price-tag").textContent = formatDollars(q.cost);

    const body = node.querySelector(".question-body");

    if (q.type === "numeric") {
      const wrapper = document.createElement("div");
      wrapper.className = "numeric-wrap";

      const numeric = document.createElement("div");
      numeric.className = "numeric-input";
      const input = document.createElement("input");
      input.type = "number";
      input.min = String(q.min);
      input.max = String(q.max);
      input.step = "1";
      input.placeholder = `${q.min}-${q.max}`;
      input.dataset.numericFor = String(q.id);
      input.addEventListener("input", () => {
        if (input.value === "") {
          setAnswer(q.id, "");
          return;
        }
        const value = Number(input.value);
        if (!Number.isInteger(value)) {
          return;
        }
        if (value < q.min || value > q.max) {
          return;
        }
        setAnswer(q.id, String(value));
      });

      const suffix = document.createElement("span");
      suffix.textContent = q.suffix || "";
      numeric.append(input, suffix);

      const clearBtn = document.createElement("button");
      clearBtn.className = "inline-clear";
      clearBtn.dataset.clearFor = String(q.id);
      clearBtn.textContent = "Clear";
      clearBtn.addEventListener("click", () => setAnswer(q.id, ""));

      wrapper.append(numeric, clearBtn);
      body.appendChild(wrapper);
    } else {
      const group = document.createElement("div");
      group.className = "radio-grid";

      q.options.forEach((option) => {
        const card = document.createElement("button");
        card.type = "button";
        card.className = "choice-card";
        card.dataset.optionFor = String(q.id);
        card.dataset.optionValue = option;

        const title = document.createElement("div");
        title.className = "choice-title";
        title.textContent = option;

        card.appendChild(title);
        card.addEventListener("click", () => setAnswer(q.id, option));
        group.appendChild(card);
      });

      const controls = document.createElement("div");
      controls.className = "question-controls";
      const clearBtn = document.createElement("button");
      clearBtn.type = "button";
      clearBtn.className = "inline-clear";
      clearBtn.dataset.clearFor = String(q.id);
      clearBtn.textContent = "Clear";
      clearBtn.addEventListener("click", () => setAnswer(q.id, ""));
      controls.appendChild(clearBtn);

      body.append(group, controls);
    }

    el.questionsContainer.appendChild(node);
    syncQuestionUI(q.id);
  });
}

function snapshotForm() {
  return {
    fullName: el.fullName.value.trim(),
    venmoHandle: el.venmoHandle.value.trim(),
    phoneNumber: el.phoneNumber.value.trim(),
    answers: { ...state.answers },
  };
}

function renderMyGuesses() {
  if (!state.mySubmission || !state.mySubmission.answers) {
    el.myGuessesCard.innerHTML = "";
    return;
  }

  const listItems = state.questions
    .filter((q) => state.mySubmission.answers[String(q.id)] !== undefined)
    .map((q) => `<li><strong>${q.id}.</strong> ${state.mySubmission.answers[String(q.id)]}</li>`)
    .join("");

  el.myGuessesCard.innerHTML = `
    <div class="my-guesses">
      <h3>Your Submitted Guesses (${state.mySubmission.fullName})</h3>
      <ul>${listItems || "<li>No answered questions in this submission.</li>"}</ul>
    </div>
  `;
}

async function submitSurvey(paymentMethod) {
  const payload = snapshotForm();
  if (!payload.fullName) {
    alert("Please enter your full name.");
    showView("survey");
    return false;
  }

  const res = await fetch("/api/submissions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, paymentMethod }),
  });

  const data = await res.json();
  if (!res.ok) {
    alert(data.error || "Submission failed.");
    return false;
  }

  state.mySubmission = {
    fullName: payload.fullName,
    venmoHandle: payload.venmoHandle,
    phoneNumber: payload.phoneNumber,
    createdAt: new Date().toISOString(),
    answers: { ...payload.answers },
  };

  clearDraft();
  await loadResults();
  showView("results");
  return true;
}

function renderNumeric(question, wrapper) {
  const max = Math.max(5, question.scaleMax || 5);

  const scale = document.createElement("div");
  scale.className = "scale";
  const line = document.createElement("div");
  line.className = "scale-line";
  scale.appendChild(line);

  question.points.forEach((point, index) => {
    const pin = document.createElement("div");
    pin.className = "pin";
    pin.style.left = `${(point.value / max) * 100}%`;
    pin.style.top = `${18 + (index % 3) * 10}px`;
    pin.style.background = point.color;
    pin.title = `${point.name}: ${point.value}`;
    pin.textContent = point.initials;
    scale.appendChild(pin);
  });

  const labels = document.createElement("div");
  labels.className = "scale-labels";
  labels.innerHTML = `<span>0</span><span>${max}</span>`;
  scale.appendChild(labels);

  wrapper.appendChild(scale);
}

function renderMultipleChoice(question, wrapper) {
  const barsWrap = document.createElement("div");
  barsWrap.className = "bars";
  const maxCount = Math.max(1, ...question.bars.map((b) => b.count));

  question.bars.forEach((bar) => {
    const row = document.createElement("div");
    row.className = "bar-row";

    const label = document.createElement("div");
    label.textContent = bar.option;

    const track = document.createElement("div");
    track.className = "bar-track";

    const fill = document.createElement("div");
    fill.className = "bar-fill";
    fill.style.width = `${(bar.count / maxCount) * 100}%`;

    const avatars = document.createElement("div");
    avatars.className = "avatar-group";
    bar.participants.slice(0, 14).forEach((p) => {
      const a = document.createElement("div");
      a.className = "avatar";
      a.title = p.name;
      a.style.background = p.color;
      a.textContent = p.initials;
      avatars.appendChild(a);
    });

    fill.appendChild(avatars);
    track.appendChild(fill);

    const count = document.createElement("div");
    count.textContent = `${bar.count}`;

    row.append(label, track, count);
    barsWrap.appendChild(row);
  });

  wrapper.appendChild(barsWrap);
}

async function loadResults() {
  const res = await fetch("/api/results");
  const data = await res.json();

  el.resultMeta.textContent = `${data.totalSubmissions} total submission(s).`;
  el.resultsContainer.innerHTML = "";
  renderMyGuesses();

  data.questions.forEach((question) => {
    const section = document.createElement("div");
    section.className = "result-question";
    const h = document.createElement("h3");
    h.textContent = `${question.id}. ${question.text}`;
    section.appendChild(h);

    if (question.type === "numeric") {
      renderNumeric(question, section);
    } else {
      renderMultipleChoice(question, section);
    }

    el.resultsContainer.appendChild(section);
  });
}

function renderSummary() {
  const { answeredCount, total } = getSummary();
  el.summaryStats.innerHTML = [
    statsTile("Questions answered", answeredCount),
    statsTile("Total owed", formatDollars(total)),
  ].join("");
}

async function adminFetchState() {
  const res = await fetch("/api/admin/state", {
    headers: { "X-Admin-Password": state.adminPassword },
  });
  if (!res.ok) {
    throw new Error("Admin auth failed.");
  }
  return res.json();
}

function renderAdminAnswerInputs(correctAnswers = {}) {
  el.adminAnswersContainer.innerHTML = "";

  state.questions.forEach((q) => {
    const card = document.createElement("div");
    card.className = "card question-card";
    const head = document.createElement("div");
    head.className = "question-head";
    head.innerHTML = `<h3>${q.id}. ${q.text}</h3><span class="price-tag">${formatDollars(q.cost)}</span>`;

    const body = document.createElement("div");
    body.className = "question-body";

    if (q.type === "numeric") {
      const input = document.createElement("input");
      input.type = "number";
      input.min = String(q.min);
      input.max = String(q.max);
      input.step = "1";
      input.value = correctAnswers[q.id] || "";
      input.dataset.adminQid = String(q.id);
      body.appendChild(input);
    } else {
      const select = document.createElement("select");
      select.dataset.adminQid = String(q.id);
      const blank = document.createElement("option");
      blank.value = "";
      blank.textContent = "-- no correct answer yet --";
      select.appendChild(blank);

      q.options.forEach((opt) => {
        const option = document.createElement("option");
        option.value = opt;
        option.textContent = opt;
        if ((correctAnswers[q.id] || "") === opt) {
          option.selected = true;
        }
        select.appendChild(option);
      });
      body.appendChild(select);
    }

    card.append(head, body);
    el.adminAnswersContainer.appendChild(card);
  });
}

function renderAdminPayoutTables(payload) {
  el.adminTotals.innerHTML = [
    statsTile("Total collected", formatDollars(payload.totalCollected)),
    statsTile("Total owed out", formatDollars(payload.totalOwed)),
    statsTile("House remainder", formatDollars(payload.houseRemainder)),
  ].join("");

  const personRows = payload.byPerson
    .map(
      (p) => `
      <tr>
        <td><span class="avatar" style="display:inline-flex;background:${p.color};vertical-align:middle;margin-right:8px;">${p.initials}</span>${p.name}</td>
        <td>${formatDollars(p.paidIn)}</td>
        <td>${formatDollars(p.owed)}</td>
        <td>${formatDollars(p.net)}</td>
      </tr>`
    )
    .join("");

  el.adminByPerson.innerHTML = `
    <h3>By Person</h3>
    <table class="admin-table">
      <thead><tr><th>Name</th><th>Paid In</th><th>Owed</th><th>Net</th></tr></thead>
      <tbody>${personRows || `<tr><td colspan="4">No submissions yet.</td></tr>`}</tbody>
    </table>
  `;

  const questionRows = payload.questionBreakdown
    .map(
      (q) => `
      <tr>
        <td>${q.questionId}</td>
        <td>${q.correctAnswer || "-"}</td>
        <td>${formatDollars(q.collected)}</td>
        <td>${q.winners.join(", ") || "None"}</td>
        <td>${formatDollars(q.splitAmount)}</td>
      </tr>`
    )
    .join("");

  el.adminByQuestion.innerHTML = `
    <h3>By Question</h3>
    <table class="admin-table">
      <thead><tr><th>Q</th><th>Correct</th><th>Collected</th><th>Winner(s)</th><th>Each gets</th></tr></thead>
      <tbody>${questionRows}</tbody>
    </table>
  `;
}

async function loadAdminState() {
  const payload = await adminFetchState();
  renderAdminAnswerInputs(payload.correctAnswers || {});
  renderAdminPayoutTables(payload);
}

async function saveCorrectAnswers() {
  const answers = {};
  document.querySelectorAll("[data-admin-qid]").forEach((node) => {
    answers[node.dataset.adminQid] = node.value;
  });

  const res = await fetch("/api/admin/correct-answers", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Admin-Password": state.adminPassword,
    },
    body: JSON.stringify({ answers }),
  });

  const payload = await res.json();
  if (!res.ok) {
    alert(payload.error || "Could not save answers.");
    return;
  }
  renderAdminPayoutTables(payload);
  alert("Correct answers saved.");
}

async function lookupSubmissionByLast4() {
  const last4 = (el.lookupLast4.value || "").replace(/\D/g, "");
  el.lookupLast4.value = last4;

  if (last4.length !== 4) {
    el.lookupError.textContent = "Please enter exactly 4 digits.";
    return;
  }

  const res = await fetch("/api/view-guesses", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ last4 }),
  });

  const payload = await res.json();
  if (!res.ok) {
    el.lookupError.textContent = payload.error || "Not found.";
    return;
  }

  state.mySubmission = payload.submission;
  await loadResults();
  showView("results");
}

function wireDraftEvents() {
  [el.fullName, el.venmoHandle, el.phoneNumber].forEach((input) => {
    input.addEventListener("input", saveDraft);
  });
}

function wireEvents() {
  document.getElementById("toSummary").addEventListener("click", () => {
    renderSummary();
    showView("summary");
  });

  document.getElementById("backToSurvey").addEventListener("click", () => showView("survey"));

  document.getElementById("payCash").addEventListener("click", async () => {
    const ok = await submitSurvey("cash");
    if (ok) {
      await loadResults();
    }
  });

  document.getElementById("payVenmo").addEventListener("click", () => showView("venmo"));
  document.getElementById("venmoBack").addEventListener("click", () => showView("summary"));

  document.getElementById("venmoDone").addEventListener("click", async () => {
    const ok = await submitSurvey("venmo");
    if (ok) {
      await loadResults();
    }
  });

  document.getElementById("refreshResults").addEventListener("click", loadResults);

  document.getElementById("viewGuessesBtn").addEventListener("click", () => {
    el.lookupError.textContent = "";
    el.lookupLast4.value = "";
    showView("viewGuessesAccess");
  });

  document.getElementById("lookupGuessesBtn").addEventListener("click", lookupSubmissionByLast4);
  document.getElementById("lookupCancelBtn").addEventListener("click", () => showView("survey"));

  document.getElementById("adminToggle").addEventListener("click", () => {
    state.previousView = activeViewName();
    el.adminLoginError.textContent = "";
    document.getElementById("adminPassword").value = "";
    showView("adminLogin");
  });

  document.getElementById("adminCancelBtn").addEventListener("click", async () => {
    if (state.previousView === "results") {
      await loadResults();
      showView("results");
      return;
    }
    showView(state.previousView || "survey");
  });

  document.getElementById("adminLoginBtn").addEventListener("click", async () => {
    const password = document.getElementById("adminPassword").value;
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (!res.ok) {
      el.adminLoginError.textContent = "Invalid password.";
      return;
    }

    state.adminPassword = password;
    await loadAdminState();
    showView("admin");
  });

  document.getElementById("adminCloseBtn").addEventListener("click", async () => {
    await loadResults();
    showView("results");
  });

  document.getElementById("saveAnswersBtn").addEventListener("click", saveCorrectAnswers);
  document.getElementById("calcPayoutBtn").addEventListener("click", loadAdminState);
}

async function init() {
  const res = await fetch("/api/questions");
  const data = await res.json();
  state.questions = data.questions;

  restoreDraft();
  renderQuestions();
  updateTally();
  wireDraftEvents();
  wireEvents();
}

init();
