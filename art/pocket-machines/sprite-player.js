/** Small Canvas 2D helper for the included single-row PNG sheets. */
export function frameIndex(animation, elapsedMs) {
  const frame = Math.floor(Math.max(0, elapsedMs) * animation.fps / 1000);
  return animation.loop ? frame % animation.frameCount : Math.min(frame, animation.frameCount - 1);
}

/** x/y is the ground anchor, not the upper-left corner. */
export function drawSprite(ctx, image, animation, {
  x, y, elapsedMs = 0, scale = 64 / 300, facing = 'right',
}) {
  const frame = frameIndex(animation, elapsedMs);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing === 'left' ? -scale : scale, scale);
  ctx.drawImage(image,
    frame * animation.frameWidth, 0, animation.frameWidth, animation.frameHeight,
    -animation.anchor.x, -animation.anchor.y, animation.frameWidth, animation.frameHeight);
  ctx.restore();
  return frame;
}

/** Load only the sheet needed for the current state; cache at the call site. */
export function loadSheet(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not load sprite sheet: ${url}`));
    image.src = url;
  });
}
