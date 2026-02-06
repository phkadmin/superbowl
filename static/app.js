const STORAGE_KEY = "sb_betting_draft_v2";

const state = {
  questions: [],
  answers: {},
  squareSelections: [],
  squaresPublic: null,
  squaresRevealed: null,
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
  squaresSummary: document.getElementById("squaresSummary"),
  squaresGridWrap: document.getElementById("squaresGridWrap"),
  summaryStats: document.getElementById("summaryStats"),
  resultMeta: document.getElementById("resultMeta"),
  resultsContainer: document.getElementById("resultsContainer"),
  resultsSquares: document.getElementById("resultsSquares"),
  myGuessesCard: document.getElementById("myGuessesCard"),
  adminAnswersContainer: document.getElementById("adminAnswersContainer"),
  adminTotals: document.getElementById("adminTotals"),
  adminByPerson: document.getElementById("adminByPerson"),
  adminByQuestion: document.getElementById("adminByQuestion"),
  adminSquaresPot: document.getElementById("adminSquaresPot"),
  adminSquaresScoreInputs: document.getElementById("adminSquaresScoreInputs"),
  adminSquaresGrid: document.getElementById("adminSquaresGrid"),
  adminSquaresWinners: document.getElementById("adminSquaresWinners"),
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
  return `<div class="stat"><div class="label">${label}</div><div class="value">${value}</div></div>`;
}

function keyForSquare(square) {
  return `${square.row}-${square.col}`;
}

function isSquareMine(row, col) {
  return state.squareSelections.some((sq) => sq.row === row && sq.col === col);
}

function saveDraft() {
  const payload = {
    fullName: el.fullName.value.trim(),
    venmoHandle: el.venmoHandle.value.trim(),
    phoneNumber: el.phoneNumber.value.trim(),
    answers: state.answers,
    squareSelections: state.squareSelections,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function restoreDraft() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const payload = JSON.parse(raw);
    state.answers = payload.answers && typeof payload.answers === "object" ? payload.answers : {};
    state.squareSelections = Array.isArray(payload.squareSelections) ? payload.squareSelections : [];
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
  const totalFromQuestions = answered.reduce((sum, q) => sum + q.cost, 0);
  const squareCost = (state.squaresPublic?.cost || 4) * state.squareSelections.length;
  return {
    answeredCount: answered.length,
    squaresCount: state.squareSelections.length,
    total: totalFromQuestions + squareCost,
  };
}

function updateTally() {
  const { total } = getSummary();
  el.tallyPill.textContent = `${formatDollars(total)} owed`;
}

function syncQuestionUI(questionId) {
  const qid = String(questionId);
  const value = state.answers[qid];

  const clearBtn = document.querySelector(`[data-clear-for="${qid}"]`);
  if (clearBtn) clearBtn.disabled = value === undefined || value === "";

  const input = document.querySelector(`[data-numeric-for="${qid}"]`);
  if (input) input.value = value || "";

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
        if (!Number.isInteger(value) || value < q.min || value > q.max) return;
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
        card.innerHTML = `<div class="choice-title">${option}</div>`;
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

function renderSquaresSummary() {
  const cost = state.squaresPublic?.cost || 4;
  const max = state.squaresPublic?.maxPerUser || 5;
  el.squaresSummary.innerHTML = [
    statsTile("Selected Squares", `${state.squareSelections.length}/${max}`),
    statsTile("Price Per Square", formatDollars(cost)),
    statsTile("Squares Total", formatDollars(cost * state.squareSelections.length)),
  ].join("");
}

function makeSquareTable({ hiddenNumbers, rowDigits, colDigits, takenByCell, onCellClick, mineSet, showPeople }) {
  const table = document.createElement("table");
  table.className = "squares-grid";

  const headRow = document.createElement("tr");
  const corner = document.createElement("th");
  corner.innerHTML = `<span class="axis-label">SEA / NE</span>`;
  headRow.appendChild(corner);

  for (let col = 0; col < 10; col += 1) {
    const th = document.createElement("th");
    th.textContent = hiddenNumbers ? "?" : String(colDigits[col]);
    headRow.appendChild(th);
  }
  table.appendChild(headRow);

  for (let row = 0; row < 10; row += 1) {
    const tr = document.createElement("tr");
    const rowHead = document.createElement("th");
    rowHead.textContent = hiddenNumbers ? "?" : String(rowDigits[row]);
    tr.appendChild(rowHead);

    for (let col = 0; col < 10; col += 1) {
      const td = document.createElement("td");
      td.className = "square-cell";
      const key = `${row}-${col}`;
      const taken = takenByCell.get(key);
      const mine = mineSet.has(key);

      if (taken) {
        td.classList.add("taken");
        if (mine) td.classList.add("mine");
        if (showPeople) {
          td.textContent = taken.initials || "";
          td.title = taken.name || "Taken";
        } else {
          if (mine) {
            td.textContent = "•";
            td.title = "Your selection";
          } else {
            td.innerHTML = `<span class="square-avatar" style="background:${taken.color || "#ffffff"};">${taken.initials || ""}</span>`;
            td.title = taken.name ? `${taken.name} selected this square` : "Taken";
            td.disabled = true;
          }
        }
      } else if (mine) {
        td.classList.add("selected");
        td.textContent = "•";
        td.title = "Selected";
      }

      if (typeof onCellClick === "function") {
        td.addEventListener("click", () => onCellClick(row, col));
      }

      tr.appendChild(td);
    }

    table.appendChild(tr);
  }

  return table;
}

function renderSurveySquares() {
  if (!state.squaresPublic) return;

  const takenMap = new Map((state.squaresPublic.taken || []).map((s) => [keyForSquare(s), { initials: "", name: "Taken" }]));
  const mineSet = new Set(state.squareSelections.map(keyForSquare));

  const table = makeSquareTable({
    hiddenNumbers: true,
    rowDigits: Array.from({ length: 10 }, (_, i) => i),
    colDigits: Array.from({ length: 10 }, (_, i) => i),
    takenByCell: takenMap,
    mineSet,
    showPeople: false,
    onCellClick: (row, col) => {
      const key = `${row}-${col}`;
      if (takenMap.has(key) && !mineSet.has(key)) return;

      if (mineSet.has(key)) {
        state.squareSelections = state.squareSelections.filter((sq) => !(sq.row === row && sq.col === col));
      } else {
        const max = state.squaresPublic.maxPerUser || 5;
        if (state.squareSelections.length >= max) {
          alert(`You can select up to ${max} squares.`);
          return;
        }
        state.squareSelections.push({ row, col });
      }
      renderSurveySquares();
      renderSquaresSummary();
      updateTally();
      saveDraft();
    },
  });

  el.squaresGridWrap.innerHTML = "";
  el.squaresGridWrap.appendChild(table);
}

function snapshotForm() {
  return {
    fullName: el.fullName.value.trim(),
    venmoHandle: el.venmoHandle.value.trim(),
    phoneNumber: el.phoneNumber.value.trim(),
    answers: { ...state.answers },
    squareSelections: [...state.squareSelections],
  };
}

function renderMyGuesses() {
  if (!state.mySubmission || !state.mySubmission.answers) {
    el.myGuessesCard.innerHTML = "";
    return;
  }

  const answered = state.questions
    .filter((q) => state.mySubmission.answers[String(q.id)] !== undefined)
    .map((q) => `<li><strong>${q.id}.</strong> ${state.mySubmission.answers[String(q.id)]}</li>`)
    .join("");

  const sq = state.mySubmission.squares || [];
  const squareText = sq.length ? sq.map((s) => `R${s.row + 1} C${s.col + 1}`).join(", ") : "None";

  el.myGuessesCard.innerHTML = `
    <div class="my-guesses">
      <h3>Your Submitted Guesses (${state.mySubmission.fullName})</h3>
      <ul>${answered || "<li>No answered questions in this submission.</li>"}</ul>
      <p><strong>Your Squares:</strong> ${squareText}</p>
    </div>
  `;
}

function renderResultsSquares() {
  if (!state.squaresRevealed) {
    el.resultsSquares.innerHTML = "";
    return;
  }

  const takenMap = new Map((state.squaresRevealed.taken || []).map((s) => [keyForSquare(s), s]));
  const mineSet = new Set((state.mySubmission?.squares || []).map(keyForSquare));

  const table = makeSquareTable({
    hiddenNumbers: false,
    rowDigits: state.squaresRevealed.rowDigits,
    colDigits: state.squaresRevealed.colDigits,
    takenByCell: takenMap,
    mineSet,
    showPeople: true,
  });

  el.resultsSquares.innerHTML = `<div class="result-question"><h3>Super Bowl Squares (Revealed)</h3></div>`;
  el.resultsSquares.querySelector(".result-question").appendChild(table);
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
    if (res.status === 409) {
      await loadSquaresPublic();
      renderSurveySquares();
      renderSquaresSummary();
    }
    return false;
  }

  state.mySubmission = {
    fullName: payload.fullName,
    venmoHandle: payload.venmoHandle,
    phoneNumber: payload.phoneNumber,
    createdAt: new Date().toISOString(),
    answers: { ...payload.answers },
    squares: [...payload.squareSelections],
  };

  clearDraft();
  state.squareSelections = [];
  await loadResults();
  showView("results");
  return true;
}

function renderNumeric(question, wrapper) {
  const max = Math.max(5, question.scaleMax || 5);
  const scale = document.createElement("div");
  scale.className = "scale";
  scale.innerHTML = `<div class="scale-line"></div>`;

  question.points.forEach((point, index) => {
    const pin = document.createElement("div");
    pin.className = "pin";
    pin.style.left = `${(point.value / max) * 100}%`;
    pin.style.top = `${18 + (index % 3) * 10}px`;
    pin.style.background = point.color;
    pin.title = `${point.name}: guess ${point.value}`;
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

async function loadSquaresPublic() {
  const res = await fetch("/api/squares/public");
  state.squaresPublic = await res.json();

  const takenKeys = new Set((state.squaresPublic.taken || []).map(keyForSquare));
  state.squareSelections = state.squareSelections.filter((sq) => !takenKeys.has(keyForSquare(sq)));
}

async function loadResults() {
  const [resultsRes, squaresRes] = await Promise.all([fetch("/api/results"), fetch("/api/squares/revealed")]);
  const data = await resultsRes.json();
  state.squaresRevealed = await squaresRes.json();

  el.resultMeta.textContent = `${data.totalSubmissions} total submission(s).`;
  el.resultsContainer.innerHTML = "";

  renderMyGuesses();
  renderResultsSquares();

  data.questions.forEach((question) => {
    const section = document.createElement("div");
    section.className = "result-question";
    section.innerHTML = `<h3>${question.id}. ${question.text}</h3>`;
    if (question.type === "numeric") renderNumeric(question, section);
    else renderMultipleChoice(question, section);
    el.resultsContainer.appendChild(section);
  });
}

function renderSummary() {
  const { answeredCount, squaresCount, total } = getSummary();
  el.summaryStats.innerHTML = [
    statsTile("Questions answered", answeredCount),
    statsTile("Squares selected", squaresCount),
    statsTile("Total owed", formatDollars(total)),
  ].join("");
}

async function adminFetchState() {
  const res = await fetch("/api/admin/state", { headers: { "X-Admin-Password": state.adminPassword } });
  if (!res.ok) throw new Error("Admin auth failed.");
  return res.json();
}

function renderAdminAnswerInputs(correctAnswers = {}) {
  el.adminAnswersContainer.innerHTML = "";
  state.questions.forEach((q) => {
    const card = document.createElement("div");
    card.className = "card question-card";
    card.innerHTML = `<div class="question-head"><h3>${q.id}. ${q.text}</h3><span class="price-tag">${formatDollars(q.cost)}</span></div>`;
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
      select.innerHTML = `<option value="">-- no correct answer yet --</option>`;
      q.options.forEach((opt) => {
        const option = document.createElement("option");
        option.value = opt;
        option.textContent = opt;
        if ((correctAnswers[q.id] || "") === opt) option.selected = true;
        select.appendChild(option);
      });
      body.appendChild(select);
    }

    card.appendChild(body);
    el.adminAnswersContainer.appendChild(card);
  });
}

function renderAdminSquaresSection(squares) {
  if (!squares) return;

  el.adminSquaresPot.innerHTML = [
    statsTile("Squares Pot", formatDollars(squares.pot)),
    statsTile("Per Quarter", formatDollars(squares.quarterShare)),
  ].join("");

  const scoreFields = ["q1", "q2", "q3", "q4"]
    .map(
      (q) => `
      <label>${q.toUpperCase()} Patriots
        <input type="number" min="0" max="200" data-square-score="${q}-patriots" value="${squares.scores[q].patriots ?? ""}" />
      </label>
      <label>${q.toUpperCase()} Seahawks
        <input type="number" min="0" max="200" data-square-score="${q}-seahawks" value="${squares.scores[q].seahawks ?? ""}" />
      </label>`
    )
    .join("");
  el.adminSquaresScoreInputs.innerHTML = scoreFields;

  const takenMap = new Map((squares.board.taken || []).map((s) => [keyForSquare(s), s]));
  const table = makeSquareTable({
    hiddenNumbers: false,
    rowDigits: squares.board.rowDigits,
    colDigits: squares.board.colDigits,
    takenByCell: takenMap,
    mineSet: new Set(),
    showPeople: true,
  });
  el.adminSquaresGrid.innerHTML = "";
  el.adminSquaresGrid.appendChild(table);

  const lines = ["q1", "q2", "q3", "q4"]
    .map((q) => {
      const r = squares.quarters[q];
      const winner = r.winner ? `${r.winner.name} (${r.winner.initials})` : "No winning square owner";
      return `<tr><td>${q.toUpperCase()}</td><td>${r.patriots ?? "-"}</td><td>${r.seahawks ?? "-"}</td><td>${winner}</td><td>${formatDollars(r.amount)}</td></tr>`;
    })
    .join("");

  el.adminSquaresWinners.innerHTML = `
    <table class="admin-table">
      <thead><tr><th>Quarter</th><th>Patriots</th><th>Seahawks</th><th>Winner</th><th>Payout</th></tr></thead>
      <tbody>${lines}</tbody>
    </table>
  `;
}

function renderAdminPayoutTables(payload) {
  el.adminTotals.innerHTML = [
    statsTile("Total collected", formatDollars(payload.totalCollected)),
    statsTile("Total owed out", formatDollars(payload.totalOwed)),
    statsTile("House remainder", formatDollars(payload.houseRemainder)),
  ].join("");

  const personRows = payload.byPerson
    .map(
      (p) => `<tr><td><span class="avatar" style="display:inline-flex;background:${p.color};vertical-align:middle;margin-right:8px;">${p.initials}</span>${p.name}</td><td>${formatDollars(p.paidIn)}</td><td>${formatDollars(p.owed)}</td><td>${formatDollars(p.net)}</td></tr>`
    )
    .join("");

  el.adminByPerson.innerHTML = `
    <h3>By Person</h3>
    <table class="admin-table"><thead><tr><th>Name</th><th>Paid In</th><th>Owed</th><th>Net</th></tr></thead>
    <tbody>${personRows || `<tr><td colspan="4">No submissions yet.</td></tr>`}</tbody></table>
  `;

  const questionRows = payload.questionBreakdown
    .map(
      (q) => `<tr><td>${q.questionId}</td><td>${q.correctAnswer || "-"}</td><td>${formatDollars(q.collected)}</td><td>${q.winners.join(", ") || "None"}</td><td>${formatDollars(q.splitAmount)}</td></tr>`
    )
    .join("");

  el.adminByQuestion.innerHTML = `
    <h3>By Question</h3>
    <table class="admin-table"><thead><tr><th>Q</th><th>Correct</th><th>Collected</th><th>Winner(s)</th><th>Each gets</th></tr></thead>
    <tbody>${questionRows}</tbody></table>
  `;

  renderAdminSquaresSection(payload.squares);
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
    headers: { "Content-Type": "application/json", "X-Admin-Password": state.adminPassword },
    body: JSON.stringify({ answers }),
  });

  const payload = await res.json();
  if (!res.ok) {
    alert(payload.error || "Could not save answers.");
    return;
  }
  renderAdminPayoutTables(payload);
}

async function saveSquareScores() {
  const scores = { q1: {}, q2: {}, q3: {}, q4: {} };
  document.querySelectorAll("[data-square-score]").forEach((input) => {
    const [quarter, team] = input.dataset.squareScore.split("-");
    scores[quarter][team] = input.value === "" ? null : Number(input.value);
  });

  for (const quarter of ["q1", "q2", "q3", "q4"]) {
    for (const team of ["patriots", "seahawks"]) {
      const v = scores[quarter][team];
      if (v !== null && (!Number.isInteger(v) || v < 0 || v > 200)) {
        alert(`Invalid ${quarter.toUpperCase()} ${team} score.`);
        return;
      }
    }
  }

  const res = await fetch("/api/admin/squares-scores", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Admin-Password": state.adminPassword },
    body: JSON.stringify({ scores }),
  });

  const payload = await res.json();
  if (!res.ok) {
    alert(payload.error || "Could not save square scores.");
    return;
  }
  renderAdminPayoutTables(payload);
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
    if (ok) await loadResults();
  });
  document.getElementById("payVenmo").addEventListener("click", () => showView("venmo"));
  document.getElementById("venmoBack").addEventListener("click", () => showView("summary"));
  document.getElementById("venmoDone").addEventListener("click", async () => {
    const ok = await submitSurvey("venmo");
    if (ok) await loadResults();
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
  document.getElementById("saveSquareScoresBtn").addEventListener("click", saveSquareScores);
}

async function init() {
  const qRes = await fetch("/api/questions");
  state.questions = (await qRes.json()).questions;

  restoreDraft();
  await loadSquaresPublic();

  renderQuestions();
  renderSurveySquares();
  renderSquaresSummary();
  updateTally();

  wireDraftEvents();
  wireEvents();
}

init();
