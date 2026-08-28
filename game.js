const laneNames = ["1", "2", "3", "4", "5", "6", "7"];
const defaultKeyConfigs = {
  4: ["D", "F", "J", "K"],
  5: ["S", "D", "F", "J", "K"],
  6: ["S", "D", "F", "J", "K", "L"],
  7: ["A", "S", "D", "F", "J", "K", "L"]
};
const x = "./assets/N 2 0 0.png";
const y = "./assets/N 3 0 0.png";

const laneSkinOrder = {
  4: [x, y, y, x],
  5: [x, y, x, y, x],
  6: [x, y, x, x, y, x],
  7: [x, y, x, y, x, y, x]
};

const patternOptionMap = {
  4: ["pair", "triple", "random-2-3"],
  5: ["pair", "triple", "quad", "random-2-3", "random-2-4", "random-3-4"],
  6: ["pair", "triple", "quad", "penta", "random-2-3", "random-2-4", "random-3-4", "random-4-5"],
  7: ["pair", "triple", "quad", "penta", "hexa", "random-2-3", "random-2-4", "random-3-4", "random-4-5"]
};

const laneCountSelect = document.getElementById("laneCountSelect");
const patternModeSelect = document.getElementById("patternModeSelect");
const modeSelect = document.getElementById("modeSelect");
const scoreEl = document.getElementById("score");
const comboEl = document.getElementById("combo");
const maxComboEl = document.getElementById("maxCombo");
const patternSummaryEl = document.getElementById("patternSummary");
const statusTextEl = document.getElementById("statusText");
const patternBoardEl = document.getElementById("patternBoard");
const keyConfigEl = document.getElementById("keyConfig");
const laneConfigListEl = document.getElementById("laneConfigList");
const gameViewButton = document.getElementById("gameViewButton");
const configViewButton = document.getElementById("configViewButton");
const gameViewEl = document.getElementById("gameView");
const configViewEl = document.getElementById("configView");
const startButton = document.getElementById("startButton");
const resetButton = document.getElementById("resetButton");

const savedKeyConfigs = JSON.parse(localStorage.getItem("lateralTrainerKeyConfigs") || "{}");

const state = {
  laneCount: 4,
  patternMode: "pair",
  mode: "normal",
  keyConfigsByLane: {
    4: savedKeyConfigs[4] || [...defaultKeyConfigs[4]],
    5: savedKeyConfigs[5] || [...defaultKeyConfigs[5]],
    6: savedKeyConfigs[6] || [...defaultKeyConfigs[6]],
    7: savedKeyConfigs[7] || [...defaultKeyConfigs[7]]
  },
  keyConfig: [],
  pattern: [],
  pressedSet: new Set(),
  score: 0,
  combo: 0,
  maxCombo: 0,
  round: 0,
  started: false,
  roundLocked: false,
  phase: "preview",
  countdownRemaining: 0,
  attackDeadline: 0,
  timeLoopId: null
};

function loadLaneConfig(laneCount) {
  const config = state.keyConfigsByLane[laneCount] || [...defaultKeyConfigs[laneCount]];
  state.keyConfigsByLane[laneCount] = config;
  return [...config];
}

function saveLaneConfig() {
  localStorage.setItem("lateralTrainerKeyConfigs", JSON.stringify(state.keyConfigsByLane));
}

function normalizeKeyValue(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (raw === " ") return "Space";
  if (raw.length === 1) return raw.toUpperCase();
  return raw.replace(/^./, (ch) => ch.toUpperCase());
}

function shuffle(list) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function getPatternSizeForMode() {
  const laneCount = state.laneCount;

  if (state.patternMode === "pair") return 2;
  if (state.patternMode === "triple") return 3;
  if (state.patternMode === "quad") return 4;
  if (state.patternMode === "penta") return 5;
  if (state.patternMode === "hexa") return 6;
  if (state.patternMode === "septa") return 7;

  if (state.patternMode === "random-2-3") return Math.random() < 0.5 ? 2 : 3;
  if (state.patternMode === "random-2-4") return Math.random() < 0.5 ? 2 : (Math.random() < 0.5 ? 3 : 4);
  if (state.patternMode === "random-3-4") return Math.random() < 0.5 ? 3 : 4;
  if (state.patternMode === "random-4-5") return Math.random() < 0.5 ? 4 : 5;

  return 2;
}

function generatePattern() {
  const laneCount = state.laneCount;
  const pool = Array.from({ length: laneCount }, (_, index) => index);
  let targetSize = getPatternSizeForMode();

  if (targetSize > laneCount - 1) {
    targetSize = laneCount - 1;
  }

  if (laneCount <= 2) {
    targetSize = laneCount;
  }

  const pattern = shuffle(pool).slice(0, targetSize).sort((a, b) => a - b);
  return pattern;
}

function renderHud() {
  scoreEl.textContent = String(state.score);
  comboEl.textContent = String(state.combo);
  maxComboEl.textContent = String(state.maxCombo);
}

function renderPatternBoard() {
  patternBoardEl.style.setProperty("--lane-count", String(state.laneCount));
  patternBoardEl.classList.toggle("is-live", state.phase === "playing" || state.phase === "score-attack");
  patternBoardEl.innerHTML = "";

  const laneSkinMap = laneSkinOrder[state.laneCount] || [x, y, y, x];

  for (let lane = 0; lane < state.laneCount; lane += 1) {
    const cell = document.createElement("div");
    cell.className = "lane-cell";
    const skin = laneSkinMap[lane] === x ? x : y;
    cell.style.setProperty("--note-skin", `url("${skin}")`);

    if (state.pattern.includes(lane)) {
      cell.classList.add("is-target");
    }

    if (state.pressedSet.has(lane)) {
      cell.classList.add("is-pressed");
    }

    const laneNumber = document.createElement("div");
    laneNumber.className = "lane-number";
    laneNumber.textContent = `L${laneNames[lane]}`;

    const laneKey = document.createElement("div");
    laneKey.className = "lane-key";
    laneKey.textContent = state.keyConfig[lane];

    cell.appendChild(laneNumber);
    cell.appendChild(laneKey);
    patternBoardEl.appendChild(cell);
  }

  if (state.pattern.length === 0) {
    patternSummaryEl.textContent = state.phase === "preview" ? "待機中" : "待機中";
  } else {
    const labels = state.pattern.map((lane) => state.keyConfig[lane]);
    patternSummaryEl.textContent = labels.join(" / ");
  }
}

function renderKeyConfig() {
  keyConfigEl.innerHTML = "";

  for (let lane = 0; lane < 7; lane += 1) {
    const row = document.createElement("label");
    row.className = "key-row";

    const label = document.createElement("span");
    label.textContent = `L${lane + 1}`;

    const input = document.createElement("input");
    input.type = "text";
    input.className = "key-input";
    input.value = lane < state.laneCount ? state.keyConfig[lane] : "-";
    input.disabled = lane >= state.laneCount;
    input.dataset.index = String(lane);
    input.placeholder = lane < state.laneCount ? state.keyConfig[lane] : "-";

    input.addEventListener("focus", () => {
      input.value = "";
      input.placeholder = "キーを押す";
    });

    input.addEventListener("keydown", (event) => {
      event.preventDefault();
      const key = normalizeKeyValue(event.key);
      if (!key) return;
      state.keyConfig[lane] = key;
      state.keyConfigsByLane[state.laneCount] = [...state.keyConfig];
      saveLaneConfig();
      renderKeyConfig();
      renderLaneConfigList();
      renderPatternBoard();
    });

    row.appendChild(label);
    row.appendChild(input);
    keyConfigEl.appendChild(row);
  }
}

function renderLaneConfigList() {
  laneConfigListEl.innerHTML = "";

  [4, 5, 6, 7].forEach((laneCount) => {
    const section = document.createElement("div");
    section.className = "lane-config-group";

    const header = document.createElement("div");
    header.className = "lane-config-header";
    header.innerHTML = `<span>レーン数 ${laneCount}</span><span>${loadLaneConfig(laneCount).join(" / ")}</span>`;

    const grid = document.createElement("div");
    grid.className = "lane-config-grid";

    for (let lane = 0; lane < laneCount; lane += 1) {
      const cell = document.createElement("div");
      cell.className = "lane-config-cell";
      const key = state.keyConfigsByLane[laneCount]?.[lane] || defaultKeyConfigs[laneCount][lane];
      cell.innerHTML = `<span>L${lane + 1}</span><strong>${key}</strong>`;
      grid.appendChild(cell);
    }

    section.appendChild(header);
    section.appendChild(grid);
    laneConfigListEl.appendChild(section);
  });
}

function beginPreview() {
  state.phase = "preview";
  state.started = false;
  state.pattern = generatePattern();
  state.pressedSet.clear();
  state.roundLocked = false;
  patternSummaryEl.textContent = state.pattern.map((lane) => state.keyConfig[lane]).join(" / ");
  renderPatternBoard();
}

function scheduleCountdown() {
  state.phase = "countdown";
  state.countdownRemaining = 3;
  patternBoardEl.classList.remove("is-live");
  renderPatternBoard();
  statusTextEl.textContent = `開始まで ${state.countdownRemaining}`;

  const tick = () => {
    state.countdownRemaining -= 1;
    if (state.countdownRemaining > 0) {
      statusTextEl.textContent = `開始まで ${state.countdownRemaining}`;
      setTimeout(tick, 1000);
      return;
    }

    state.phase = state.mode === "score-attack" ? "score-attack" : "playing";
    state.started = true;
    state.roundLocked = false;
    state.pressedSet.clear();
    renderHud();
    state.pattern = [];
    renderPatternBoard();

    if (state.mode === "score-attack") {
      state.attackDeadline = performance.now() + 60000;
      statusTextEl.textContent = "スコアアタック開始! 60.0秒";
    } else {
      statusTextEl.textContent = "開始!";
    }

    generateNextPattern();
  };

  setTimeout(tick, 1000);
}

function startGame() {
  if (state.phase === "countdown" || state.phase === "playing" || state.phase === "score-attack") {
    return;
  }

  state.score = 0;
  state.combo = 0;
  state.maxCombo = 0;
  state.round = 0;
  state.started = false;
  state.roundLocked = false;
  state.pressedSet.clear();
  renderHud();
  scheduleCountdown();
}

function resetGame() {
  state.phase = "preview";
  state.started = false;
  state.score = 0;
  state.combo = 0;
  state.maxCombo = 0;
  state.round = 0;
  state.pattern = [];
  state.pressedSet.clear();
  state.roundLocked = false;
  state.countdownRemaining = 0;
  state.attackDeadline = 0;
  renderHud();
  renderPatternBoard();
  statusTextEl.textContent = "スタートで開始";
  patternSummaryEl.textContent = "待機中";
}

function generateNextPattern() {
  if (!state.started || state.phase === "preview" || state.phase === "countdown") return;
  state.pattern = generatePattern();
  state.pressedSet.clear();
  state.roundLocked = false;
  renderPatternBoard();
  statusTextEl.textContent = state.mode === "score-attack"
    ? `スコアアタック中: ${Math.max(0, (state.attackDeadline - performance.now()) / 1000).toFixed(1)}秒`
    : `パターン出現: ${state.pattern.map((lane) => state.keyConfig[lane]).join(" / ")}`;
}

function checkClear() {
  if (!state.started || state.roundLocked) return;

  const required = new Set(state.pattern);
  const satisfied = Array.from(required).every((lane) => state.pressedSet.has(lane));

  if (!satisfied) {
    return;
  }

  state.roundLocked = true;
  state.combo += 1;
  state.maxCombo = Math.max(state.maxCombo, state.combo);
  state.score += 100 + state.pattern.length * 50 + state.combo * 25;
  state.round += 1;
  renderHud();
  statusTextEl.textContent = state.mode === "score-attack"
    ? `クリア! ${Math.max(0, (state.attackDeadline - performance.now()) / 1000).toFixed(1)}秒残り`
    : `クリア!`;
  renderPatternBoard();
  generateNextPattern();
}

function registerMiss(reason) {
  state.combo = 0;
  if (state.mode === "score-attack") {
    state.score = 0;
  }
  renderHud();
  statusTextEl.textContent = reason;
}

function handleKeyDown(event) {
  if (document.activeElement && document.activeElement.classList.contains("key-input")) {
    return;
  }

  if (state.phase !== "playing" && state.phase !== "score-attack") {
    return;
  }

  const keyName = normalizeKeyValue(event.key);
  if (!keyName || event.repeat) return;

  const laneIndex = state.keyConfig.findIndex((entry) => normalizeKeyValue(entry) === keyName);
  if (laneIndex === -1) return;

  if (laneIndex >= state.laneCount) return;

  event.preventDefault();

  if (!state.pattern.includes(laneIndex)) {
    registerMiss(`ミス: ${state.keyConfig[laneIndex]} は対象ではありません`);
    return;
  }

  state.pressedSet.add(laneIndex);
  renderPatternBoard();
  checkClear();
}

function handleKeyUp(event) {
  if (document.activeElement && document.activeElement.classList.contains("key-input")) {
    return;
  }

  if (state.phase !== "playing" && state.phase !== "score-attack") {
    return;
  }

  const keyName = normalizeKeyValue(event.key);
  if (!keyName) return;

  const laneIndex = state.keyConfig.findIndex((entry) => normalizeKeyValue(entry) === keyName);
  if (laneIndex === -1 || laneIndex >= state.laneCount) return;

  state.pressedSet.delete(laneIndex);
  renderPatternBoard();
}

function updatePatternOptions() {
  const allowedModes = patternOptionMap[state.laneCount] || ["pair", "triple", "random-2-3"];
  const currentSelection = state.patternMode;

  patternModeSelect.innerHTML = "";
  allowedModes.forEach((mode) => {
    const option = document.createElement("option");
    option.value = mode;
    option.textContent = {
      pair: "2個同時押し",
      triple: "3個同時押し",
      quad: "4個同時押し",
      penta: "5個同時押し",
      hexa: "6個同時押し",
      septa: "7個同時押し",
      "random-2-3": "2〜3ランダム",
      "random-2-4": "2〜4ランダム",
      "random-3-4": "3〜4ランダム",
      "random-4-5": "4〜5ランダム"
    }[mode] || mode;
    patternModeSelect.appendChild(option);
  });

  if (!allowedModes.includes(currentSelection)) {
    state.patternMode = allowedModes[0];
  }

  patternModeSelect.value = state.patternMode;
}

laneCountSelect.addEventListener("change", (event) => {
  state.laneCount = Number(event.target.value);
  state.keyConfig = loadLaneConfig(state.laneCount);
  updatePatternOptions();
  renderKeyConfig();
  renderPatternBoard();
  if (state.started) {
    generateNextPattern();
  }
});

patternModeSelect.addEventListener("change", (event) => {
  state.patternMode = event.target.value;
  if (state.phase === "preview") {
    beginPreview();
  }
});

modeSelect.addEventListener("change", (event) => {
  state.mode = event.target.value;
  if (state.phase === "preview") {
    beginPreview();
  }
});

gameViewButton.addEventListener("click", () => {
  gameViewButton.classList.add("active");
  configViewButton.classList.remove("active");
  gameViewEl.classList.add("active");
  configViewEl.classList.remove("active");
});

configViewButton.addEventListener("click", () => {
  configViewButton.classList.add("active");
  gameViewButton.classList.remove("active");
  configViewEl.classList.add("active");
  gameViewEl.classList.remove("active");
});

startButton.addEventListener("click", () => {
  startGame();
});

resetButton.addEventListener("click", () => {
  resetGame();
});

document.addEventListener("keydown", handleKeyDown);
document.addEventListener("keyup", handleKeyUp);

setInterval(() => {
  if (state.mode !== "score-attack" || state.phase !== "score-attack") return;
  const remaining = Math.max(0, (state.attackDeadline - performance.now()) / 1000);
  statusTextEl.textContent = `スコアアタック中: ${remaining.toFixed(1)}秒`;

  if (remaining <= 0) {
    state.phase = "preview";
    state.started = false;
    state.pattern = [];
    state.pressedSet.clear();
    renderPatternBoard();
    statusTextEl.textContent = `タイムアップ! スコア: ${state.score}`;
    patternSummaryEl.textContent = "結果";
  }
}, 100);

state.keyConfig = loadLaneConfig(state.laneCount);
renderHud();
updatePatternOptions();
renderKeyConfig();
renderLaneConfigList();
beginPreview();
