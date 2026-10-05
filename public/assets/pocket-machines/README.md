# Merge Crew — Pocket Machines

The approved Pocket Machines direction, delivered as transparent PNG sprite sheets. Created 2026-10-05.

## Included

- Four characters: Tidy, Blaze, Drift, Hoarder.
- Nine animations per character: idle, move, hop, talk, happy (celebrate), scared (panic), guilty (oops), thinking, signature.
- **36 sheets, four frames each: 144 drawn keyframes.**
- Every sheet is **2048 × 512 px**, containing **four 512 × 512 px frames in one horizontal row**, ordered left to right. Genuine RGBA transparency.
- Four 512 × 512 px full-body portraits, taken from the first idle frame.
- manifest.json: paths, dimensions, counts, FPS, loop flags, anchors, scale and signature descriptions.
- sprite-player.js: a small optional Canvas 2D renderer with frame selection and left/right mirroring.
- preview.html: a local interactive comparison with state buttons, pause, individual-frame inspection, mirroring, warm/dark/transparency backgrounds, a 64 px map view and approximately 300 px desktop portraits. It works by opening the file beside its sprites directory; no remote libraries or services are required.
- crew.png: a transparent crew lineup.
- pose-review.png: one representative frame from all nine states per character. Rows: Tidy, Blaze, Drift, Hoarder. Columns: idle, move, hop, talk, happy, scared, guilty, thinking, signature.
- `art/pocket-machines/` (repository root, not served by the game): prompts.md and source-boards/, the original generation prompts and the twelve generated multi-row source boards, preserved for revisions. Use sprites/ for game integration.
- verification.json and browser-verification.json: the completed export and browser checks.

## Placement and scale

All robots face right. Mirror around the anchor to face left.

The common ground anchor in each frame is **x = 256, y = 464**. Coordinates refer to the full 512 px frame, including its transparent padding. Anchor the character at the commit node; do not align by the frame's bottom edge. Tidy and Hoarder stand on this line, Blaze rolls on it, and Drift's pod floats over it. Hop frames include a small upward displacement inside the frame, so do not add a second hop offset unless intentionally amplifying the motion.

Resting artwork is approximately 300 px tall, including antennas and packs. The files share the same drawing scale. For approximately 64 px tall map characters, use **scale = 64 / 300**, producing a displayed frame of approximately **109.23 × 109.23 px** including its transparent padding. For desktop portraits, scale = 1 gives approximately 300 px artwork in a 512 px frame. Shrink the preview on narrow screens as needed.

Transparent padding protects the expressive poses. Keep anchors constant when switching states.

## Timing

Every listed animation has four 512 × 512 px frames. Filenames use sprites/{character}-{state}.png.

| State | FPS | Duration per cycle | Loop in game |
| --- | --- | --- | --- |
| idle | 2 | 2.00 s | yes |
| move | 8 | 0.50 s | yes |
| hop | 5 | 0.80 s | no |
| talk | 6 | 0.67 s | yes |
| happy | 5 | 0.80 s | no |
| scared | 8 | 0.50 s | yes |
| guilty | 5 | 0.80 s | no |
| thinking | 5 | 0.80 s | yes |
| signature | 5 | 0.80 s | no |

For a one-shot action, play once, then transition back to idle after frameCount / fps seconds. The helper holds the last frame until the caller switches states. The preview repeats every state for inspection, including one-shot actions.

These are short, drawn keyframe cycles. Expressions, hand gestures and silhouettes change between frames; they are not a continuous skeletal rig. Small redraw differences can be visible at portrait size. No movement distance is baked into the move sheet; translate the anchor along the branch in game code.

## Signature actions

| Robot | Action |
| --- | --- |
| Tidy | Squares two crooked file cards, then offers the tidy stack. |
| Blaze | Attempts a small overconfident wheelie. |
| Drift | Follows its wobbling antenna bead and forgets what it was doing. |
| Hoarder | Opens its pack, catches an escaping folder, then hugs the files. |

## Canvas example

```js
import { drawSprite, loadSheet } from './sprite-player.js';

const manifest = await fetch('./manifest.json').then(response => response.json());
const animation = manifest.characters.tidy.animations.move;
const image = await loadSheet(animation.file);

// Inside the game's render loop. Reset elapsedMs when changing animations.
drawSprite(ctx, image, animation, {
  x: commitX,
  y: commitY,
  elapsedMs: timeSinceStateStarted,
  scale: 64 / 300,
  facing: 'right',
});
```

Resolve file paths relative to the asset folder when mounting it elsewhere. Load and cache the sheets needed for active states rather than preloading all 36 full-resolution images into the game.

## Verification and limits

Automated export checks passed for dimensions, frame counts, transparency, nonempty frames, safe margins, nine-state coverage, common anchors and scale. The original twelve generated boards were visually inspected. A representative frame from every exported animation was inspected in pose-review.png. The interactive preview was visually reviewed at desktop and phone sizes, including the map view and large portraits.

Browser checks passed for all nine state selectors, individual-frame selection, playback, pause, mirroring, background switching, 36 image loads, and no horizontal page overflow at 1440, 390 and 320 px. The optional drawing helper's loop and one-shot frame selection and mirrored anchor behavior were also checked in the browser.

Integration in the actual game is **not tested**. The game still uses its code-drawn placeholders. This package provides the assets and animation metadata for the integration step.

## Tool, rights and attribution

Artwork was generated with **OpenAI's built-in image-generation tool in Codex**. The tool did not expose the exact underlying model version. Inputs were docs/art-brief.md and the original Pocket Machines concept lineup. Character edits and poses were generated with the same tool. PNG slicing, resizing and equal-frame assembly used the local Sharp library; no third-party character art was supplied.

OpenAI's individual-use terms assign its rights in output to the user, to the extent permitted by applicable law. Those terms support your use and distribution of these images in a free game and public repository, subject to the terms and respecting third-party rights. Output may not be unique; the terms do not guarantee copyright protection or exclusivity. Tool usage terms are distinct from the asset license you choose for your repository. The PNG artwork is released under CC0 1.0 Universal. See LICENSE-art.md and the repository ASSETS.md for the licence and attribution notice.

Terms checked 2026-10-05:

- [Europe Terms of Use — Content ownership and similarity](https://openai.com/policies/eu-terms-of-use/)
- [Terms of Use — Content ownership and similarity](https://openai.com/policies/terms-of-use/)
- [Sharing and publication policy](https://openai.com/policies/sharing-publication-policy/)

Keep clear AI provenance in the game's credits and repository. Suggested factual credit:

> Character art generated with OpenAI image generation. Pocket Machines art direction selected for Merge Crew.

## Game integration

The assets are served from /assets/pocket-machines/. Use sprites/, portraits/, manifest.json and optional sprite-player.js from that base URL. All animation frames are ordered left to right. Use the common anchor and the manifest loop/FPS values. Switch from one-shot animations back to idle when their duration expires. Verify the actual map and speech-bubble flows with these assets before release. Carry the generation provenance and the asset licence in ASSETS.md into the game credits.
