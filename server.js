
import express from "express";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const PORT = process.env.PORT || 3000;
const DAILY_SEED = process.env.WORDLE_DAILY_SEED || "wordle-seed";
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || "";
const RESULTS_FILE = process.env.RESULTS_FILE || "wordle_results.json";
const RECAP_UTC_HOUR = Number(process.env.RECAP_UTC_HOUR || 23);
const RECAP_UTC_MINUTE = Number(process.env.RECAP_UTC_MINUTE || 55);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MAX_GUESSES = 6;
const WORD_LENGTH = 4;
const WORDS = Array.from(new Set("able acid aged also area army away baby back ball band bank base bath bear beat been bell belt best bird blow blue boat body bomb bond bone book boom born boss both bowl bulk burn bush busy call calm came camp card care case cash cast cave chat chip city club coal coat code cold come cook cool cope copy core cost crew crop dark data date dawn days dead deal dear deck deep deer desk dial diet disk does done door dose down draw drew drop drug dual duck duke dust duty each earn ease east easy echo edge else even ever evil exam exit face fact fair fall farm fast fate fear feed feel feet fell felt file fill film find fine fire firm fish five flat flow food fool foot ford form fort four free frog from fuel full fund gain game gate gave gear gene gift girl give glad goal goes gold golf gone good gray grew grow gulf hair half hall hand hang hard harm hate have head heal hear heat held help here hero hide high hill hire hold hole holy home hope host hour huge hung hunt idea inch into iron item jack jail join joke jump jury just keen keep kept kick kind king knee knew know lack lady laid lake land lane last late lazy lead leaf lean left less life lift like line link list live load loan lock logo long look lord loss lost love luck made mail main make male many mark mass mate math meal mean meat meet menu mere mile milk mind mine miss mode mood moon more most move much must name navy near neck need news next nice nine none noon nose note okay once only onto open oral over pace pack page paid pair pale palm park part pass past path peak pick pile pine pink pipe plan play plot plug plus poll pool poor port post pull pure push race rain rank rare rate read real rear rely rent rest rice rich ride ring rise risk road rock role roll roof room root rose rule rush safe said sail sake sale salt same sand save seat seed seek seem seen self sell send sent ship shop shot show shut sick side sign silk sing sink site size skin slip slow snow soft soil sold sole some song soon sort soul spot star stay step stop such suit sure take tale talk tall tank tape task team tell tend tent term test than that them then thin this thus tide tile time tiny told toll tone tool tour town tree trip true tune turn twin type unit upon used user vast very view vote wage wait wake walk wall want ward warm wash wave weak wear week well went were west what when wide wife wild will wind wine wing wire wise wish with wood wool word wore work yard year your zero zone".split(/\s+/))).sort();
const WORD_SET = new Set(WORDS);

app.use(express.json({ limit: "256kb" }));
app.use((_req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });

function today() { return new Date().toISOString().slice(0, 10); }
function wordleNumber(date = today()) {
  const start = new Date("2021-06-19T00:00:00.000Z");
  const current = new Date(`${date}T00:00:00.000Z`);
  return Math.max(1, Math.floor((current - start) / 86400000) + 1);
}
function dailyWord(date = today()) {
  const hash = crypto.createHash("sha256").update(`${DAILY_SEED}:${date}`).digest("hex");
  return WORDS[Number(BigInt(`0x${hash}`) % BigInt(WORDS.length))];
}
function scoreGuess(guess, answer) {
  const result = Array(WORD_LENGTH).fill("absent");
  const remaining = {};
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (guess[i] === answer[i]) result[i] = "correct";
    else remaining[answer[i]] = (remaining[answer[i]] || 0) + 1;
  }
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (result[i] === "correct") continue;
    if (remaining[guess[i]] > 0) { result[i] = "present"; remaining[guess[i]]--; }
  }
  return result;
}
function squares(score) {
  return score.map(x => x === "correct" ? "🟩" : x === "present" ? "🟨" : "⬛").join("");
}
function cleanName(name) {
  return String(name || "Anonymous").replace(/[`*_~>|@#]/g, "").replace(/\s+/g, " ").trim().slice(0, 32) || "Anonymous";
}
function loadStore() {
  try {
    if (!fs.existsSync(RESULTS_FILE)) return { results: [], recapPostedDates: [] };
    const data = JSON.parse(fs.readFileSync(RESULTS_FILE, "utf8"));
    return { results: data.results || [], recapPostedDates: data.recapPostedDates || [] };
  } catch { return { results: [], recapPostedDates: [] }; }
}
function saveStore(store) { fs.writeFileSync(RESULTS_FILE, JSON.stringify(store, null, 2)); }
async function postWebhook(payload) {
  if (!DISCORD_WEBHOOK_URL) return { skipped: true };
  const r = await fetch(DISCORD_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!r.ok) throw new Error(`Webhook failed: ${r.status} ${await r.text().catch(() => "")}`);
}
function resultPayload(result) {
  const scoreText = result.solved ? `${result.guessCount}/6` : "X/6";
  const rows = result.scores.map(squares).join("\n") || "No guesses.";
  return {
    username: "Wordle",
    content: `**${result.playerName}** finished **Wordle No. ${wordleNumber(result.date)}** — **${scoreText}**\n${rows}\n\nPlay now!`,
    allowed_mentions: { parse: [] }
  };
}
function recapPayload(date = today()) {
  const store = loadStore();
  const results = store.results.filter(r => r.date === date).sort((a,b) => (a.solved ? a.guessCount : 99) - (b.solved ? b.guessCount : 99));
  if (!results.length) return { username: "Wordle", content: `**Wordle No. ${wordleNumber(date)} recap**\nNo results were recorded today.`, allowed_mentions: { parse: [] } };
  const solved = results.filter(r => r.solved);
  const lines = [];
  for (let i = 1; i <= 6; i++) {
    const names = solved.filter(r => r.guessCount === i).map(r => r.playerName);
    if (names.length) lines.push(`**${i}/6:** ${names.join(", ")}`);
  }
  const failed = results.filter(r => !r.solved).map(r => r.playerName);
  if (failed.length) lines.push(`**X/6:** ${failed.join(", ")}`);
  const winRate = Math.round((solved.length / results.length) * 100);
  return {
    username: "Wordle",
    content: `**Wordle No. ${wordleNumber(date)} daily recap**\nPlayers: **${results.length}** • Solved: **${solved.length}** • Win rate: **${winRate}%**\n\n${lines.join("\n")}\n\nPlay now!`,
    allowed_mentions: { parse: [] }
  };
}
async function postRecap(date = today()) {
  const store = loadStore();
  if (store.recapPostedDates.includes(date)) return { alreadyPosted: true };
  await postWebhook(recapPayload(date));
  store.recapPostedDates.push(date);
  saveStore(store);
  return { posted: true };
}
setInterval(() => {
  const now = new Date();
  if (now.getUTCHours() === RECAP_UTC_HOUR && now.getUTCMinutes() === RECAP_UTC_MINUTE) {
    postRecap(today()).catch(e => console.error("recap failed", e));
  }
}, 60000);

app.get("/api/config", (_req, res) => res.json({
  wordLength: WORD_LENGTH,
  maxGuesses: MAX_GUESSES,
  date: today(),
  wordleNumber: wordleNumber(),
  webhookEnabled: Boolean(DISCORD_WEBHOOK_URL)
}));
app.post("/api/guess", (req, res) => {
  const guess = String(req.body?.guess || "").trim().toLowerCase();
  if (guess.length !== WORD_LENGTH) return res.status(400).json({ ok: false, error: "Guess must be 4 letters." });
  if (!/^[a-z]+$/.test(guess)) return res.status(400).json({ ok: false, error: "Guess can only contain letters." });
  if (!WORD_SET.has(guess)) return res.status(400).json({ ok: false, error: "Not in word list." });
  const answer = dailyWord();
  const score = scoreGuess(guess, answer);
  res.json({ ok: true, guess, score, isCorrect: guess === answer, date: today() });
});
app.get("/api/answer", (_req, res) => res.json({ answer: dailyWord().toUpperCase(), date: today() }));
app.post("/api/result", async (req, res) => {
  const date = today();
  const playerName = cleanName(req.body?.playerName);
  const guesses = Array.isArray(req.body?.guesses) ? req.body.guesses : [];
  const scores = Array.isArray(req.body?.scores) ? req.body.scores : [];
  const solved = Boolean(req.body?.solved);
  const guessCount = Number(req.body?.guessCount || guesses.length || 0);
  const clientResultId = String(req.body?.clientResultId || crypto.randomUUID()).slice(0, 80);
  const store = loadStore();
  if (store.results.find(r => r.date === date && r.clientResultId === clientResultId)) return res.json({ ok: true, duplicate: true });
  const result = { id: crypto.randomUUID(), clientResultId, date, playerName, guesses, scores, solved, guessCount, createdAt: new Date().toISOString() };
  store.results.push(result);
  saveStore(store);
  try { await postWebhook(resultPayload(result)); }
  catch(e) { console.error(e); return res.status(500).json({ ok: false, error: "Result saved, but webhook post failed." }); }
  res.json({ ok: true });
});
app.post("/api/recap", async (_req, res) => {
  try { res.json({ ok: true, ...(await postRecap(today())) }); }
  catch(e) { console.error(e); res.status(500).json({ ok: false, error: e.message || "Recap failed." }); }
});
app.get("/api/results", (_req, res) => {
  const store = loadStore();
  res.json({ date: today(), wordleNumber: wordleNumber(), results: store.results.filter(r => r.date === today()) });
});
app.use(express.static(path.join(__dirname, "client")));
app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "client", "index.html")));
app.listen(PORT, () => {
  console.log(`Wordle Activity server on ${PORT}`);
  console.log(`Webhook: ${DISCORD_WEBHOOK_URL ? "enabled" : "disabled"}`);
});
