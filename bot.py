import os
import json
import hashlib
from dataclasses import dataclass, field
from collections import Counter
from datetime import datetime, timezone

import discord
from discord import app_commands
from discord.ext import commands


DATA_FILE = "wordle_gui_stats.json"
MAX_GUESSES = 6
WORD_LENGTH = 4
DAILY_SEED = os.getenv("WORDLE_DAILY_SEED", "my-4-letter-wordle-v1")

WORDS = sorted(set("""
able acid aged also area army away baby back ball band bank base bath bear beat been bell belt best bird blow blue boat body bomb bond bone book boom born boss both bowl bulk burn bush busy call calm came camp card care case cash cast cave chat chip city club coal coat code cold come cook cool cope copy core cost crew crop dark data date dawn days dead deal dear deck deep deer desk dial diet disk does done door dose down draw drew drop drug dual duck duke dust duty each earn ease east easy echo edge else even ever evil exam exit face fact fair fall farm fast fate fear feed feel feet fell felt file fill film find fine fire firm fish five flat flow food fool foot ford form fort four free frog from fuel full fund gain game gate gave gear gene gift girl give glad goal goes gold golf gone good gray grew grow gulf hair half hall hand hang hard harm hate have head heal hear heat held help here hero hide high hill hire hold hole holy home hope host hour huge hung hunt idea inch into iron item jack jail join joke jump jury just keen keep kept kick kind king knee knew know lack lady laid lake land lane last late lazy lead leaf lean left less life lift like line link list live load loan lock logo long look lord loss lost love luck made mail main make male many mark mass mate math meal mean meat meet menu mere mile milk mind mine miss mode mood moon more most move much must name navy near neck need news next nice nine none noon nose note okay once only onto open oral over pace pack page paid pair pale palm park part pass past path peak pick pile pine pink pipe plan play plot plug plus poll pool poor port post pull pure push race rain rank rare rate read real rear rely rent rest rice rich ride ring rise risk road rock role roll roof room root rose rule rush safe said sail sake sale salt same sand save seat seed seek seem seen self sell send sent ship shop shot show shut sick side sign silk sing sink site size skin slip slow snow soft soil sold sole some song soon sort soul spot star stay step stop such suit sure take tale talk tall tank tape task team tell tend tent term test than that them then thin this thus tide tile time tiny told toll tone tool tour town tree trip true tune turn twin type unit upon used user vast very view vote wage wait wake walk wall want ward warm wash wave weak wear week well went were west what when wide wife wild will wind wine wing wire wise wish with wood wool word wore work yard year your zero zone
""".split()))

WORD_SET = set(WORDS)

KEYBOARD_PAGES = [
    list("QWERTYUIOPASD"),
    list("FGHJKLZXCVBNM"),
]

COLOR_EMOJI = {
    "correct": "🟩",
    "present": "🟨",
    "absent": "⬛",
}

KEYBOARD_RANK = {
    "unknown": 0,
    "absent": 1,
    "present": 2,
    "correct": 3,
}


def get_daily_word() -> str:
    today = datetime.now(timezone.utc).date().isoformat()
    raw = f"{DAILY_SEED}:{today}".encode("utf-8")
    digest = hashlib.sha256(raw).hexdigest()
    index = int(digest, 16) % len(WORDS)
    return WORDS[index]


@dataclass
class GameState:
    owner_id: int
    owner_name: str
    stats_key: str
    answer: str
    guesses: list[str] = field(default_factory=list)
    current: str = ""
    keyboard: dict[str, str] = field(default_factory=dict)
    game_over: bool = False
    result_text: str = ""

    @classmethod
    def new(cls, interaction: discord.Interaction) -> "GameState":
        guild_id = interaction.guild_id or 0
        return cls(
            owner_id=interaction.user.id,
            owner_name=interaction.user.display_name,
            stats_key=f"{guild_id}:{interaction.user.id}",
            answer=get_daily_word(),
        )


def load_stats() -> dict:
    if not os.path.exists(DATA_FILE):
        return {}

    try:
        with open(DATA_FILE, "r", encoding="utf-8") as file:
            return json.load(file)
    except json.JSONDecodeError:
        return {}


def save_stats(stats: dict) -> None:
    with open(DATA_FILE, "w", encoding="utf-8") as file:
        json.dump(stats, file, indent=2)


def default_user_stats() -> dict:
    return {
        "played": 0,
        "wins": 0,
        "losses": 0,
        "current_streak": 0,
        "best_streak": 0,
        "guess_distribution": {str(i): 0 for i in range(1, MAX_GUESSES + 1)},
    }


def get_user_stats(stats_key: str) -> dict:
    stats = load_stats()
    if stats_key not in stats:
        stats[stats_key] = default_user_stats()
        save_stats(stats)
    return stats[stats_key]


def record_win(stats_key: str, guess_count: int) -> None:
    stats = load_stats()
    user = stats.setdefault(stats_key, default_user_stats())

    user["played"] += 1
    user["wins"] += 1
    user["current_streak"] += 1
    user["best_streak"] = max(user["best_streak"], user["current_streak"])
    user["guess_distribution"][str(guess_count)] += 1

    save_stats(stats)


def record_loss(stats_key: str) -> None:
    stats = load_stats()
    user = stats.setdefault(stats_key, default_user_stats())

    user["played"] += 1
    user["losses"] += 1
    user["current_streak"] = 0

    save_stats(stats)


def validate_guess(raw_guess: str) -> tuple[bool, str]:
    guess = raw_guess.lower().strip()

    if len(guess) != WORD_LENGTH:
        return False, f"Guess must be exactly {WORD_LENGTH} letters."

    if not guess.isalpha():
        return False, "Guess can only contain letters."

    if guess not in WORD_SET:
        return False, f"`{guess.upper()}` is not in this bot’s word list."

    return True, guess


def score_guess(guess: str, answer: str) -> list[str]:
    result = ["absent"] * WORD_LENGTH
    remaining = Counter()

    for i in range(WORD_LENGTH):
        if guess[i] == answer[i]:
            result[i] = "correct"
        else:
            remaining[answer[i]] += 1

    for i in range(WORD_LENGTH):
        if result[i] == "absent" and remaining[guess[i]] > 0:
            result[i] = "present"
            remaining[guess[i]] -= 1

    return result


def score_to_squares(score: list[str]) -> str:
    return "".join(COLOR_EMOJI[item] for item in score)


def spaced_word(word: str) -> str:
    return " ".join(word.upper())


def current_slots(current: str) -> str:
    letters = list(current.upper())
    while len(letters) < WORD_LENGTH:
        letters.append("_")
    return " ".join(letters)


def board_text(state: GameState) -> str:
    lines = []

    for guess in state.guesses:
        score = score_guess(guess, state.answer)
        lines.append(f"{score_to_squares(score)}  `{spaced_word(guess)}`")

    if not state.game_over and len(state.guesses) < MAX_GUESSES:
        lines.append(f"⬜⬜⬜⬜  `{current_slots(state.current)}`")

    while len(lines) < MAX_GUESSES:
        lines.append("⬜⬜⬜⬜  `_ _ _ _`")

    return "\n".join(lines)


def update_keyboard_status(state: GameState, guess: str) -> None:
    score = score_guess(guess, state.answer)

    for letter, status in zip(guess.upper(), score):
        previous = state.keyboard.get(letter, "unknown")
        if KEYBOARD_RANK[status] > KEYBOARD_RANK[previous]:
            state.keyboard[letter] = status


def keyboard_summary(state: GameState) -> str:
    correct = sorted([letter for letter, status in state.keyboard.items() if status == "correct"])
    present = sorted([letter for letter, status in state.keyboard.items() if status == "present"])
    absent = sorted([letter for letter, status in state.keyboard.items() if status == "absent"])

    return "\n".join([
        f"🟩 Correct: `{''.join(correct) if correct else '-'}`",
        f"🟨 Present: `{''.join(present) if present else '-'}`",
        f"⬛ Absent: `{''.join(absent) if absent else '-'}`",
    ])


class GuessModal(discord.ui.Modal, title="Type a 4-letter guess"):
    guess_input: discord.ui.TextInput = discord.ui.TextInput(
        label="Guess",
        placeholder="Example: CODE",
        min_length=WORD_LENGTH,
        max_length=WORD_LENGTH,
        required=True,
    )

    def __init__(self, wordle_view: "WordleView"):
        super().__init__()
        self.wordle_view = wordle_view

    async def on_submit(self, interaction: discord.Interaction) -> None:
        await self.wordle_view.submit_guess(interaction, str(self.guess_input.value))


class LetterButton(discord.ui.Button):
    def __init__(self, letter: str, row: int, style: discord.ButtonStyle, disabled: bool):
        super().__init__(label=letter, style=style, row=row, disabled=disabled)
        self.letter = letter

    async def callback(self, interaction: discord.Interaction) -> None:
        view: WordleView = self.view
        await view.add_letter(interaction, self.letter)


class PageButton(discord.ui.Button):
    def __init__(self, page: int):
        label = "More letters →" if page == 0 else "← More letters"
        super().__init__(label=label, style=discord.ButtonStyle.secondary, row=2)

    async def callback(self, interaction: discord.Interaction) -> None:
        view: WordleView = self.view
        view.page = 1 - view.page
        await view.update_message(interaction)


class EnterButton(discord.ui.Button):
    def __init__(self, disabled: bool):
        super().__init__(label="Enter", style=discord.ButtonStyle.success, row=3, disabled=disabled)

    async def callback(self, interaction: discord.Interaction) -> None:
        view: WordleView = self.view
        await view.submit_guess(interaction, view.state.current)


class DeleteButton(discord.ui.Button):
    def __init__(self, disabled: bool):
        super().__init__(label="⌫", style=discord.ButtonStyle.secondary, row=3, disabled=disabled)

    async def callback(self, interaction: discord.Interaction) -> None:
        view: WordleView = self.view
        view.state.current = view.state.current[:-1]
        await view.update_message(interaction)


class ClearButton(discord.ui.Button):
    def __init__(self, disabled: bool):
        super().__init__(label="Clear", style=discord.ButtonStyle.secondary, row=3, disabled=disabled)

    async def callback(self, interaction: discord.Interaction) -> None:
        view: WordleView = self.view
        view.state.current = ""
        await view.update_message(interaction)


class TypeButton(discord.ui.Button):
    def __init__(self, disabled: bool):
        super().__init__(label="Type Guess", style=discord.ButtonStyle.primary, row=3, disabled=disabled)

    async def callback(self, interaction: discord.Interaction) -> None:
        view: WordleView = self.view
        await interaction.response.send_modal(GuessModal(view))


class GiveUpButton(discord.ui.Button):
    def __init__(self, disabled: bool):
        super().__init__(label="Give Up", style=discord.ButtonStyle.danger, row=4, disabled=disabled)

    async def callback(self, interaction: discord.Interaction) -> None:
        view: WordleView = self.view
        state = view.state

        state.game_over = True
        state.current = ""
        state.result_text = f"Game over. The word was `{state.answer.upper()}`."
        record_loss(state.stats_key)

        await view.update_message(interaction)


class NewGameButton(discord.ui.Button):
    def __init__(self):
        super().__init__(label="New Game", style=discord.ButtonStyle.success, row=4)

    async def callback(self, interaction: discord.Interaction) -> None:
        view: WordleView = self.view
        old_state = view.state

        view.state = GameState(
            owner_id=old_state.owner_id,
            owner_name=old_state.owner_name,
            stats_key=old_state.stats_key,
            answer=get_daily_word(),
        )
        view.page = 0

        await view.update_message(interaction)


class WordleView(discord.ui.View):
    def __init__(self, state: GameState):
        super().__init__(timeout=900)
        self.state = state
        self.page = 0
        self.message: discord.Message | None = None
        self.refresh_items()

    async def interaction_check(self, interaction: discord.Interaction) -> bool:
        if interaction.user.id != self.state.owner_id:
            await interaction.response.send_message(
                f"This Wordle board belongs to **{self.state.owner_name}**. Start your own with `/wordle start`.",
                ephemeral=True,
            )
            return False
        return True

    async def on_timeout(self) -> None:
        self.state.game_over = True
        if not self.state.result_text:
            self.state.result_text = "This game timed out."

        self.refresh_items(disable_all=True)

        if self.message:
            try:
                await self.message.edit(embed=self.make_embed(), view=self)
            except discord.HTTPException:
                pass

    def style_for_letter(self, letter: str) -> discord.ButtonStyle:
        status = self.state.keyboard.get(letter, "unknown")

        if status == "correct":
            return discord.ButtonStyle.success

        if status == "present":
            return discord.ButtonStyle.primary

        return discord.ButtonStyle.secondary

    def refresh_items(self, disable_all: bool = False) -> None:
        self.clear_items()

        letters = KEYBOARD_PAGES[self.page]
        letters_disabled = disable_all or self.state.game_over or len(self.state.current) >= WORD_LENGTH

        for index, letter in enumerate(letters):
            row = index // 5
            self.add_item(
                LetterButton(
                    letter=letter,
                    row=row,
                    style=self.style_for_letter(letter),
                    disabled=letters_disabled,
                )
            )

        self.add_item(PageButton(self.page))

        controls_disabled = disable_all or self.state.game_over
        self.add_item(EnterButton(disabled=controls_disabled or len(self.state.current) != WORD_LENGTH))
        self.add_item(DeleteButton(disabled=controls_disabled or len(self.state.current) == 0))
        self.add_item(ClearButton(disabled=controls_disabled or len(self.state.current) == 0))
        self.add_item(TypeButton(disabled=controls_disabled))

        self.add_item(GiveUpButton(disabled=disable_all or self.state.game_over))
        self.add_item(NewGameButton())

    def make_embed(self) -> discord.Embed:
        color = discord.Color.blurple()

        if self.state.game_over:
            if self.state.guesses and self.state.guesses[-1] == self.state.answer:
                color = discord.Color.green()
            else:
                color = discord.Color.red()

        embed = discord.Embed(
            title="4-Letter Wordle",
            description=board_text(self.state),
            color=color,
        )

        embed.add_field(name="Current Guess", value=f"`{current_slots(self.state.current)}`", inline=False)
        embed.add_field(name="Keyboard", value=keyboard_summary(self.state), inline=False)

        if self.state.result_text:
            embed.add_field(name="Result", value=self.state.result_text, inline=False)

        embed.set_footer(text=f"Player: {self.state.owner_name} • Keyboard page {self.page + 1}/2")
        return embed

    async def update_message(self, interaction: discord.Interaction) -> None:
        self.refresh_items()
        self.message = interaction.message
        await interaction.response.edit_message(embed=self.make_embed(), view=self)

    async def add_letter(self, interaction: discord.Interaction, letter: str) -> None:
        if self.state.game_over:
            await interaction.response.send_message("This game is already over.", ephemeral=True)
            return

        if len(self.state.current) >= WORD_LENGTH:
            await interaction.response.send_message("Your guess already has 4 letters.", ephemeral=True)
            return

        self.state.current += letter.lower()
        await self.update_message(interaction)

    async def submit_guess(self, interaction: discord.Interaction, raw_guess: str) -> None:
        state = self.state

        if state.game_over:
            await interaction.response.send_message("This game is already over.", ephemeral=True)
            return

        valid, guess_or_error = validate_guess(raw_guess)
        if not valid:
            await interaction.response.send_message(guess_or_error, ephemeral=True)
            return

        guess = guess_or_error

        if guess in state.guesses:
            await interaction.response.send_message(f"You already guessed `{guess.upper()}`.", ephemeral=True)
            return

        state.guesses.append(guess)
        state.current = ""
        update_keyboard_status(state, guess)

        if guess == state.answer:
            guess_count = len(state.guesses)
            state.game_over = True
            state.result_text = f"Solved in `{guess_count}/{MAX_GUESSES}`."
            record_win(state.stats_key, guess_count)

        elif len(state.guesses) >= MAX_GUESSES:
            state.game_over = True
            state.result_text = f"No guesses left. The word was `{state.answer.upper()}`."
            record_loss(state.stats_key)

        await self.update_message(interaction)


class WordleBot(commands.Bot):
    def __init__(self):
        intents = discord.Intents.default()
        super().__init__(command_prefix="!", intents=intents)

    async def setup_hook(self):
        guild_id = os.getenv("GUILD_ID")

        if guild_id:
            guild = discord.Object(id=int(guild_id))
            self.tree.copy_global_to(guild=guild)
            await self.tree.sync(guild=guild)
            print(f"Synced slash commands to guild {guild_id}.")
        else:
            await self.tree.sync()
            print("Synced global slash commands.")

    async def on_ready(self):
        print(f"Logged in as {self.user}.")


bot = WordleBot()

wordle_group = app_commands.Group(
    name="wordle",
    description="Play 4-letter Wordle with a Discord GUI.",
)


@wordle_group.command(name="start", description="Start today's 4-letter Wordle game.")
async def start(interaction: discord.Interaction):
    state = GameState.new(interaction)
    view = WordleView(state)

    await interaction.response.send_message(embed=view.make_embed(), view=view)
    view.message = await interaction.original_response()


@wordle_group.command(name="stats", description="Show your 4-letter Wordle stats.")
async def stats(interaction: discord.Interaction):
    guild_id = interaction.guild_id or 0
    stats_key = f"{guild_id}:{interaction.user.id}"
    user_stats = get_user_stats(stats_key)

    played = user_stats["played"]
    wins = user_stats["wins"]
    losses = user_stats["losses"]
    win_rate = round((wins / played) * 100, 1) if played else 0

    distribution_lines = []
    for i in range(1, MAX_GUESSES + 1):
        count = user_stats["guess_distribution"][str(i)]
        bar = "█" * count if count else "-"
        distribution_lines.append(f"{i}: {bar} {count}")

    embed = discord.Embed(title="4-Letter Wordle Stats", color=discord.Color.blurple())
    embed.add_field(name="Played", value=str(played), inline=True)
    embed.add_field(name="Wins", value=str(wins), inline=True)
    embed.add_field(name="Losses", value=str(losses), inline=True)
    embed.add_field(name="Win Rate", value=f"{win_rate}%", inline=True)
    embed.add_field(name="Current Streak", value=str(user_stats["current_streak"]), inline=True)
    embed.add_field(name="Best Streak", value=str(user_stats["best_streak"]), inline=True)
    embed.add_field(
        name="Guess Distribution",
        value="```text\n" + "\n".join(distribution_lines) + "\n```",
        inline=False,
    )

    await interaction.response.send_message(embed=embed, ephemeral=True)


@wordle_group.command(name="help", description="Show how the GUI Wordle game works.")
async def help_command(interaction: discord.Interaction):
    await interaction.response.send_message(
        "**4-Letter Wordle GUI**\n\n"
        "`/wordle start` starts today's game.\n"
        "Everyone gets the same word each UTC day.\n"
        "Use the letter buttons to build a guess.\n"
        "Use **Enter** to submit.\n"
        "Use **⌫** or **Clear** to edit.\n"
        "Use **Type Guess** to open a modal and type a word directly.\n"
        "Use **More letters** to switch keyboard pages.\n\n"
        "🟩 correct letter, correct place\n"
        "🟨 correct letter, wrong place\n"
        "⬛ letter not in the word",
        ephemeral=True,
    )


bot.tree.add_command(wordle_group)

token = os.getenv("DISCORD_TOKEN")
if not token:
    raise RuntimeError("Missing DISCORD_TOKEN environment variable.")

bot.run(token)
