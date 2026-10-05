# Sound

Robot gibberish voices and short event sounds, synthesized with the Web Audio API. No audio files, no libraries.

- Nothing plays before the player's first click or key press (`unlock()`), and nothing plays while muted.
- The mute choice is remembered in `localStorage` (`merge-crew:sound-muted:v1`). If storage is blocked, it lives in memory for the page view.
- Master volume defaults to 0.35. The chain ends in a gentle low-pass (7 kHz) and a compressor used as a limiter (threshold -20 dB, ratio 12), so nothing gets loud.
- Safe to import on the server: no `window` access at import time.

## Files

| File | What it does |
| --- | --- |
| `voices.ts` | Pure. Splits a line into syllable-ish chunks, plans one blip per chunk timed to the typewriter. Voices per robot, shifts per mood. |
| `effects.ts` | Pure. Every event sound as a list of notes, and `scheduleCues()` that turns a map `Schedule` into timed sounds. |
| `notes.ts` | Renders one note (oscillator or noise, filter, soft envelope) into an AudioContext. |
| `engine.ts` | The `sound` singleton: `unlock`, `speak`, `stopSpeaking`, `play`, `playSchedule`, `setMuted`, `isMuted`, `toggleMuted`, `setVolume`. |
| `prefs.ts` | Mute persistence, through the shared `src/lib/storage.ts`. |
| `useSound.ts` | `useSound()` hook, `useLineVoice()` for the dialogue line, `armUnlock()`. |
| `useGameSounds.ts` | One hook that plays map, goal, win and error sounds from game state. |
| `MuteButton.tsx` | Header button, styled like "Restart level". |

## API

```ts
import { sound } from "@/components/sound";

sound.unlock();                                   // on a user gesture; safe to call often
const line = sound.speak("blaze", "scared", text, { charsPerSecond: 91 });
line.stop();                                      // or sound.stopSpeaking()
sound.play("commit");                             // "commit" | "hop" | "branch" | "lost" | "recovered" | "forcePush"
                                                  // | "conflict" | "goal" | "win" | "error" | "click"
sound.play("goal", 600);                          // optional delay in ms
sound.playSchedule(buildSchedule(events, repo), { reduce });
sound.setMuted(true); sound.isMuted(); sound.toggleMuted();
sound.setVolume(0.35);
```

`speak` options: `charsPerSecond` (default `TYPEWRITER_CPS`, about 91 per second; the dialogue box passes its own, slower speed) and `maxSeconds` (cut the line short). A new line stops the previous one.

## How the game uses it

- **Dialogue voices.** `Line` in `src/components/game/DialogueBox.tsx` calls `useLineVoice(actor, mood, text, { typing, instant, charsPerSecond })`. `Line` is keyed per line, so the voice restarts for each new line. When the player skips the typewriter, the voice stops about 90 ms later. With reduced motion the text appears at once, so the robot says a short burst (0.45 s) instead.
- **Event sounds.** `LevelGame` in `src/components/game/LevelScreen.tsx` calls `useGameSounds({ events, repo, goals, phase, log, reduce })`. It uses the same `buildSchedule` as `HistoryMap`, so sounds land with the animation:
  - commit created: pop
  - robot hop (head moved, new worktree): boing
  - branch or remote ref moved: soft swoosh
  - commits lost: descending crumble
  - commits recovered: rising chime
  - forced push (map shake): crash
  - conflict: warning blip pair

  Events that land at the same moment (a commit, its branch move and its robot hop) play one sound, the most important. It also dings when a goal ticks (after the map animation), plays the win jingle when the phase becomes `won`, and buzzes softly when the player's own command prints an error. The first render (the starting state) makes no sound.
- **Mute button.** `<MuteButton />` sits in the level header, before "Restart level". It also counts as the unlocking gesture.
- **Unlocking.** `useSound`, `useLineVoice` and `useGameSounds` all arm a one-time listener that unlocks audio on the first `pointerdown`, `keydown` or `touchend` anywhere on the page (capture phase, so it runs before the click that starts a level).

## Voices

Each blip's pitch is a scale step chosen by a hash of the chunk text and its position, so the same line always sounds the same. Lines fall slightly in pitch across a sentence, questions end with an upward slide, exclamations get a touch louder. Blips that would come faster than a voice's minimum gap are skipped, so the voice never runs past the text. Punctuation pauses shrink with a fast typewriter.

| Robot | Root | Wave | Scale | Blip / gap | Character |
| --- | --- | --- | --- | --- | --- |
| Tidy | 330 Hz | triangle, low-pass 1.9 kHz | major pentatonic | 75 / 90 ms | calm, round, even, settles slightly down |
| Blaze | 560 Hz | square, low-pass 2.7 kHz Q 2.2 | major pentatonic + octave | 50 / 58 ms | fast, buzzy, slides up 3 semitones |
| Drift | 392 Hz | sine + airy noise, vibrato 5.5 Hz ±45 cents | minor pentatonic | 140 / 150 ms | slow, dreamy, wobbly |
| Hoarder | 190 Hz | sawtooth, low-pass 950 Hz Q 3 | tight, nervous steps | 45 / 68 ms | low, 40% quick double blips, jittery timing |

| Mood | Pitch | Tempo (gap) | Brightness | Other |
| --- | --- | --- | --- | --- |
| idle, talking | 0 | 1 | 1 | |
| thinking | -1 | 1.2 | 0.85 | longer blips |
| happy | +2 | 0.95 | 1.35 | upward slide |
| celebrate | +4 | 0.9 | 1.5 | bigger upward slide |
| scared | +5 | 0.75 | 1.1 | shorter blips, tremble 12 Hz |
| surprised | +3 | 0.9 | 1.2 | strong upward slide |
| guilty | -4 | 1.35 | 0.7 | longer, quieter, sliding down |
