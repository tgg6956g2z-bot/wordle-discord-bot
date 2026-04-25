import express from "express";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const PORT = process.env.PORT || 3000;
const DAILY_SEED = process.env.WORDLE_DAILY_SEED || "my-4-letter-wordle-activity-v1";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MAX_GUESSES = 6;
const WORD_LENGTH = 4;

const WORDS = Array.from(new Set(`
able acid aged also area army away baby back ball band bank base bath bear beat been bell belt best bird blow blue boat body bomb bond bone book boom born boss both bowl bulk burn bush busy call calm came camp card care case cash cast cave chat chip city club coal coat code cold come cook cool cope copy core cost crew crop dark data date dawn days dead deal dear deck deep deer desk dial diet disk does done door dose down draw drew drop drug dual duck duke dust duty each earn ease east easy echo edge else even ever evil exam exit face fact fair fall farm fast fate fear feed feel feet fell felt file fill film find fine fire firm fish five flat flow food fool foot ford form fort four free frog from fuel full fund gain game gate gave gear gene gift girl give glad goal goes gold golf gone good gray grew grow gulf hair half hall hand hang hard harm hate have head heal hear heat held help here hero hide high hill hire hold hole holy home hope host hour huge hung hunt idea inch into iron item jack jail join joke jump jury just keen keep kept kick kind king knee knew know lack lady laid lake land lane last late lazy lead leaf lean left less life lift like line link list live load loan lock logo long look lord loss lost love luck made mail main make male many mark mass mate math meal mean meat meet menu mere mile milk mind mine miss mode mood moon more most move much must name navy near neck need news next nice nine none noon nose note okay once only onto open oral over pace pack page paid pair pale palm park part pass past path peak pick pile pine pink pipe plan play plot plug plus poll pool poor port post pull pure push race rain rank rare rate read real rear rely rent rest rice rich ride ring rise risk road rock role roll roof room root rose rule rush safe said sail sake sale salt same sand save seat seed seek seem seen self sell send sent ship shop shot show shut sick side sign silk sing sink site size skin slip slow snow soft soil sold sole some song soon sort soul spot star stay step stop such suit sure take tale talk tall tank tape task team tell tend tent term test than that them then thin this thus tide tile time tiny told toll tone tool tour town tree trip true tune turn twin type unit upon used user vast very view vote wage wait wake walk wall want ward warm wash wave weak wear week well went were west what when wide wife wild will wind wine wing wire wise wish with wood wool word wore work yard year your zero zone
`.trim().split(/\s+/))).sort();

const WORD_SET = new Set(WORDS);

app.use(express.json());

function utcDateString() {
  return new Date().toISOString().slice(0, 10);
}

function getDailyWord() {
  const date = utcDateString();
  const hash = crypto
    .createHash("sha256")
    .update(`${DAILY_SEED}:${date}`)
    .digest("hex");

  const index = BigInt(`0x${hash}`) % BigInt(WORDS.length);
  return WORDS[Number(index)];
}

function scoreGuess(guess, answer) {
  const result = Array(WORD_LENGTH).fill("absent");
  const remaining = {};

  for (let i = 0; i < WORD_LENGTH; i++) {
    if (guess[i] === answer[i]) {
      result[i] = "correct";
    } else {
      remaining[answer[i]] = (remaining[answer[i]] || 0) + 1;
    }
  }

  for (let i = 0; i < WORD_LENGTH; i++) {
    if (result[i] === "correct") continue;

    const letter = guess[i];
    if (remaining[letter] > 0) {
      result[i] = "present";
      remaining[letter] -= 1;
    }
  }

  return result;
}

app.get("/api/config", (_req, res) => {
  res.json({
    wordLength: WORD_LENGTH,
    maxGuesses: MAX_GUESSES,
    date: utcDateString(),
  });
});

app.post("/api/guess", (req, res) => {
  const guess = String(req.body?.guess || "").trim().toLowerCase();

  if (guess.length !== WORD_LENGTH) {
    return res.status(400).json({ ok: false, error: `Guess must be ${WORD_LENGTH} letters.` });
  }

  if (!/^[a-z]+$/.test(guess)) {
    return res.status(400).json({ ok: false, error: "Guess can only contain letters." });
  }

  if (!WORD_SET.has(guess)) {
    return res.status(400).json({ ok: false, error: "Not in word list." });
  }

  const answer = getDailyWord();
  const score = scoreGuess(guess, answer);
  const isCorrect = guess === answer;

  res.json({
    ok: true,
    guess,
    score,
    isCorrect,
    date: utcDateString(),
  });
});

app.get("/api/answer", (_req, res) => {
  res.json({
    answer: getDailyWord().toUpperCase(),
    date: utcDateString(),
  });
});

app.use(express.static(path.join(__dirname, "dist")));

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Wordle Activity server listening on port ${PORT}`);
});
