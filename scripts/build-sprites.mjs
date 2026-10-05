// Builds the web-ready robot sprites from the Pocket Machines source sheets.
//
//   npm run sprites
//
// Reads  public/assets/pocket-machines/sprites/*.png      (2048x512, four 512x512 frames, the source of truth)
//        public/assets/pocket-machines/portraits/*.png    (512x512)
//        public/assets/pocket-machines/manifest.json
// Writes public/assets/pocket-machines/web/map/*.webp       (small sheets for the history map)
//        public/assets/pocket-machines/web/portrait/*.webp  (larger sheets for dialogue, crew cards, win panel)
//        public/assets/pocket-machines/web/portraits/*.webp (single still portraits)
//        src/components/robots/sheets.generated.ts          (typed sheet data for the Sprite component)
//
// Every frame is first cropped to one shared box, so the transparent padding around the poses is
// not shipped. The box is the same for every frame, so the ground anchor stays one constant.
// The script fails if any artwork pixel would fall outside the box.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const base = path.join(root, "public/assets/pocket-machines");
const out = path.join(base, "web");
const manifest = JSON.parse(fs.readFileSync(path.join(base, "manifest.json"), "utf8"));

/** Shared crop inside each 512x512 source frame. */
const CROP = { x: 80, y: 128, width: 384, height: 344 };
/** Source pixels -> output pixels. Map: 64 px tall art at about 2x. Portrait: up to ~75 px tall art at 2x. */
const SIZES = { map: 0.45, portrait: 0.55 };
const PORTRAIT_STILL = 256;
const WEBP = { quality: 82, alphaQuality: 90, effort: 6, smartSubsample: true };
const ALPHA_MIN = 8;

const frame = manifest.frameWidth;
const frames = manifest.framesPerAnimation;
const robots = Object.keys(manifest.characters);
const states = Object.keys(manifest.characters[robots[0]].animations);

async function checkCrop(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let f = 0; f < frames; f++) {
    for (let y = 0; y < frame; y++) {
      for (let x = 0; x < frame; x++) {
        const inside = x >= CROP.x && x < CROP.x + CROP.width && y >= CROP.y && y < CROP.y + CROP.height;
        if (inside) continue;
        if (data[(y * info.width + f * frame + x) * 4 + 3] > ALPHA_MIN) {
          throw new Error(`${path.basename(file)} frame ${f}: artwork at (${x}, ${y}) falls outside the crop box`);
        }
      }
    }
  }
}

async function cropSheet(file) {
  const parts = await Promise.all(
    Array.from({ length: frames }, (_, f) =>
      sharp(file).extract({ left: f * frame + CROP.x, top: CROP.y, width: CROP.width, height: CROP.height }).png().toBuffer(),
    ),
  );
  return sharp({ create: { width: CROP.width * frames, height: CROP.height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(parts.map((input, f) => ({ input, left: f * CROP.width, top: 0 })))
    .png()
    .toBuffer();
}

const size = (p) => fs.statSync(p).size;
const kb = (n) => `${(n / 1024).toFixed(0)} KB`;

async function main() {
  for (const dir of ["map", "portrait", "portraits"]) fs.mkdirSync(path.join(out, dir), { recursive: true });
  let before = 0;
  const after = { map: 0, portrait: 0, portraits: 0 };
  const dims = {};
  for (const [kind, scale] of Object.entries(SIZES)) {
    dims[kind] = { scale, frameWidth: Math.round(CROP.width * scale), frameHeight: Math.round(CROP.height * scale) };
  }

  for (const robot of robots) {
    for (const state of states) {
      const anim = manifest.characters[robot].animations[state];
      if (anim.frameCount !== frames || anim.frameWidth !== frame) throw new Error(`${robot}-${state}: unexpected frame layout`);
      if (anim.anchor.x !== manifest.anchor.x || anim.anchor.y !== manifest.anchor.y) throw new Error(`${robot}-${state}: anchor differs`);
      const src = path.join(base, anim.file);
      before += size(src);
      await checkCrop(src);
      const cropped = await cropSheet(src);
      for (const kind of Object.keys(SIZES)) {
        const d = dims[kind];
        const dest = path.join(out, kind, `${robot}-${state}.webp`);
        await sharp(cropped)
          .resize(d.frameWidth * frames, d.frameHeight, { kernel: "lanczos3", fit: "fill" })
          .webp(WEBP)
          .toFile(dest);
        after[kind] += size(dest);
      }
    }
    const portrait = path.join(base, manifest.characters[robot].portrait);
    before += size(portrait);
    const dest = path.join(out, "portraits", `${robot}.webp`);
    await sharp(portrait).resize(PORTRAIT_STILL, PORTRAIT_STILL).webp(WEBP).toFile(dest);
    after.portraits += size(dest);
  }

  const animations = Object.fromEntries(
    states.map((s) => {
      const a = manifest.characters[robots[0]].animations[s];
      for (const r of robots) {
        const b = manifest.characters[r].animations[s];
        if (b.fps !== a.fps || b.loop !== a.loop) throw new Error(`${r}-${s}: timing differs between robots`);
      }
      return [s, { fps: a.fps, loop: a.loop }];
    }),
  );

  const ts = `// Generated by scripts/build-sprites.mjs from public/assets/pocket-machines/manifest.json. Do not edit.

export const ROBOTS = ${JSON.stringify(robots)} as const;
export type SpriteRobot = (typeof ROBOTS)[number];

export const STATES = ${JSON.stringify(states)} as const;
export type SpriteState = (typeof STATES)[number];

export type SheetSize = "map" | "portrait";

/** Frames per sheet, laid out left to right. */
export const FRAMES = ${frames};

/** Timing per state, the same for every robot. */
export const ANIMATIONS: Record<SpriteState, { fps: number; loop: boolean }> = ${JSON.stringify(animations, null, 2)};

/** The crop applied to each source frame, in source pixels (a source frame is ${frame}x${frame}). */
export const CROP = ${JSON.stringify(CROP)};

/** Ground anchor inside a cropped frame, in source pixels. Feet (or wheels, or the pod's float line) sit here. */
export const ANCHOR = { x: ${manifest.anchor.x - CROP.x}, y: ${manifest.anchor.y - CROP.y} };

/** Height of the resting artwork in source pixels. */
export const ART_HEIGHT = ${manifest.restingArtworkHeight};

/** Output frame sizes per sheet size, in image pixels. */
export const SHEET_SIZES: Record<SheetSize, { scale: number; frameWidth: number; frameHeight: number }> = ${JSON.stringify(dims, null, 2)};

export const sheetUrl = (size: SheetSize, robot: SpriteRobot, state: SpriteState) =>
  \`/assets/pocket-machines/web/\${size}/\${robot}-\${state}.webp\`;

export const portraitUrl = (robot: SpriteRobot) => \`/assets/pocket-machines/web/portraits/\${robot}.webp\`;
`;
  fs.writeFileSync(path.join(root, "src/components/robots/sheets.generated.ts"), ts);

  const total = after.map + after.portrait + after.portraits;
  console.log(`source PNGs: ${kb(before)}`);
  console.log(`web map sheets: ${kb(after.map)}, portrait sheets: ${kb(after.portrait)}, portraits: ${kb(after.portraits)}`);
  console.log(`web total: ${kb(total)} (${((total / before) * 100).toFixed(1)}% of source)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
