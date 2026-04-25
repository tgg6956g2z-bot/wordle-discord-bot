// SDK disabled for initial render test.

const MAX_GUESSES = 6;
const WORD_LENGTH = 4;

const STATUS_RANK = {
  unknown: 0,
  absent: 1,
  present: 2,
  correct: 3,
};

const KEY_ROWS = [
  "QWERTYUIOP".split(""),
  "ASDFGHJKL".split(""),
  ["ENTER", ..."ZXCVBNM".split(""), "⌫"],
];

const STORAGE_PREFIX = "discord-activity-wordle";

let gameDate = "";
let discordClientId = "";
let board = [];
let guesses = [];
let scores = [];
let currentGuess = "";
let currentRow = 0;
let gameOver = false;
let keyboardStatus = {};
let lastOutcome = "";

const boardEl = document.querySelector("#board");
const keyboardEl = document.querySelector("#keyboard");
const messageEl = document.querySelector("#message");
const subtitleEl = document.querySelector("#subtitle");
const newGameButton = document.querySelector("#newGameButton");
const shareButton = document.querySelector("#shareButton");
const revealButton = document.querySelector("#revealButton");

async function getConfig() {
  const response = await fetch(`${window.location.origin}/api/config`);

  if (!response.ok) {
    throw new Error(`Failed to load game config. Status: ${response.status}`);
  }

  return response.json();
}

async function initDiscordSdk() {
  const isInsideDiscord = new URLSearchParams(window.location.search).has("frame_id");

  if (isInsideDiscord) {
    subtitleEl.textContent = "Running inside Discord";
  } else {
    subtitleEl.textContent = "Local preview mode";
  }
}

function storageKey() {
  return `${STORAGE_PREFIX}:${gameDate}`;
}

function emptyBoard() {
  return Array.from({ length: MAX_GUESSES }, () =>
    Array.from({ length: WORD_LENGTH }, () => ({
      letter: "",
      status: "",
    }))
  );
}

function resetState() {
  board = emptyBoard();
  guesses = [];
  scores = [];
  currentGuess = "";
  currentRow = 0;
  gameOver = false;
  keyboardStatus = {};
  lastOutcome = "";
}

function saveState() {
  localStorage.setItem(
    storageKey(),
    JSON.stringify({
      board,
      guesses,
      scores,
      currentGuess,
      currentRow,
      gameOver,
      keyboardStatus,
      lastOutcome,
    })
  );
}

function loadState() {
  const raw = localStorage.getItem(storageKey());
  if (!raw) return false;

  try {
    const saved = JSON.parse(raw);
    board = saved.board || emptyBoard();
    guesses = saved.guesses || [];
    scores = saved.scores || [];
    currentGuess = saved.currentGuess || "";
    currentRow = saved.currentRow || 0;
    gameOver = Boolean(saved.gameOver);
    keyboardStatus = saved.keyboardStatus || {};
    lastOutcome = saved.lastOutcome || "";
    return true;
  } catch {
    return false;
  }
}

function renderBoard() {
  boardEl.innerHTML = "";

  for (let r = 0; r < MAX_GUESSES; r++) {
    const rowEl = document.createElement("div");
    rowEl.className = "row";

    for (let c = 0; c < WORD_LENGTH; c++) {
      const tile = board[r][c];
      const tileEl = document.createElement("div");

      tileEl.className = "tile";
      if (tile.letter) tileEl.classList.add("filled");
      if (tile.status) tileEl.classList.add(tile.status);
      tileEl.textContent = tile.letter;

      rowEl.appendChild(tileEl);
    }

    boardEl.appendChild(rowEl);
  }
}

function renderKeyboard() {
  keyboardEl.innerHTML = "";

  for (const keys of KEY_ROWS) {
    const rowEl = document.createElement("div");
    rowEl.className = "key-row";

    for (const key of keys) {
      const button = document.createElement("button");
      button.className = key.length > 1 ? "wide-key" : "key";
      button.textContent = key;
      button.disabled = gameOver;

      const status = keyboardStatus[key.toLowerCase()];
      if (status) button.classList.add(status);

      button.addEventListener("click", () => handleKey(key));
      rowEl.appendChild(button);
    }

    keyboardEl.appendChild(rowEl);
  }
}

function renderMessage() {
  messageEl.textContent = lastOutcome;
}

function render() {
  renderBoard();
  renderKeyboard();
  renderMessage();
}

function setMessage(text) {
  lastOutcome = text;
  renderMessage();
  saveState();
}

function addLetter(letter) {
  if (gameOver || currentGuess.length >= WORD_LENGTH) return;

  currentGuess += letter.toLowerCase();
  board[currentRow][currentGuess.length - 1].letter = letter.toUpperCase();

  saveState();
  renderBoard();
}

function deleteLetter() {
  if (gameOver || currentGuess.length === 0) return;

  const index = currentGuess.length - 1;
  currentGuess = currentGuess.slice(0, -1);
  board[currentRow][index].letter = "";
  board[currentRow][index].status = "";

  saveState();
  renderBoard();
}

function updateKeyboard(guess, score) {
  for (let i = 0; i < guess.length; i++) {
    const letter = guess[i];
    const nextStatus = score[i];
    const previousStatus = keyboardStatus[letter] || "unknown";

    if (STATUS_RANK[nextStatus] > STATUS_RANK[previousStatus]) {
      keyboardStatus[letter] = nextStatus;
    }
  }
}

async function submitGuess() {
  if (gameOver) return;

  if (currentGuess.length !== WORD_LENGTH) {
    setMessage("Not enough letters.");
    return;
  }

  const response = await fetch(`${window.location.origin}/api/guess`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ guess: currentGuess }),
  });

  const data = await response.json();

  if (!response.ok || !data.ok) {
    setMessage(data.error || "Invalid guess.");
    return;
  }

  const guess = data.guess;
  const score = data.score;

  guesses.push(guess);
  scores.push(score);

  for (let i = 0; i < WORD_LENGTH; i++) {
    board[currentRow][i].status = score[i];
  }

  updateKeyboard(guess, score);

  if (data.isCorrect) {
    gameOver = true;
    lastOutcome = `Solved in ${currentRow + 1}/${MAX_GUESSES}.`;
  } else if (currentRow + 1 >= MAX_GUESSES) {
    gameOver = true;

    const answerResponse = await fetch(`${window.location.origin}/api/answer`);
    const answerData = await answerResponse.json();

    lastOutcome = `Game over. The word was ${answerData.answer}.`;
  } else {
    currentRow += 1;
    currentGuess = "";
    lastOutcome = "";
  }

  saveState();
  render();
}

function handleKey(key) {
  if (key === "ENTER") {
    submitGuess();
    return;
  }

  if (key === "⌫") {
    deleteLetter();
    return;
  }

  addLetter(key);
}

function resultSquares(score) {
  return score
    .map((item) => {
      if (item === "correct") return "🟩";
      if (item === "present") return "🟨";
      return "⬛";
    })
    .join("");
}

async function copyResult() {
  const lines = [
    `4-Letter Wordle ${gameDate}`,
    `${guesses.length}/${MAX_GUESSES}`,
    "",
    ...scores.map(resultSquares),
  ];

  const text = lines.join("\n");

  try {
    await navigator.clipboard.writeText(text);
    setMessage("Result copied.");
  } catch {
    setMessage(text);
  }
}

async function revealAnswer() {
  const response = await fetch(`${window.location.origin}/api/answer`);
  const data = await response.json();

  gameOver = true;
  lastOutcome = `The word was ${data.answer}.`;

  saveState();
  render();
}

function resetGame() {
  localStorage.removeItem(storageKey());
  resetState();
  saveState();
  render();
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    submitGuess();
  } else if (event.key === "Backspace") {
    deleteLetter();
  } else if (/^[a-zA-Z]$/.test(event.key)) {
    addLetter(event.key.toUpperCase());
  }
});

newGameButton.addEventListener("click", resetGame);
shareButton.addEventListener("click", copyResult);
revealButton.addEventListener("click", revealAnswer);

async function main() {
  const config = await getConfig();

  gameDate = config.date;
  discordClientId = config.discordClientId || "";

  await initDiscordSdk();

  if (!loadState()) {
    resetState();
    saveState();
  }

  render();
}

main().catch((error) => {
  console.error(error);
  setMessage(`Failed to start the game: ${error.message}`);
});
