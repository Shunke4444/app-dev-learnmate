// Generate PWA icons from the mascot art.
// Run: node scripts/gen-icons.mjs
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const SRC = join(ROOT, "public", "mascot", "idle.png");
const OUT = join(ROOT, "public", "icons");

const BG = "#0B0F0E";

async function makeIcon(size, name, { maskable = false } = {}) {
  const mascot = await sharp(await readFile(SRC))
    .resize({
      width: Math.round(size * (maskable ? 0.62 : 0.78)),
      height: Math.round(size * (maskable ? 0.62 : 0.78)),
      fit: "inside",
    })
    .toBuffer();

  const canvas = sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: BG,
    },
  });

  const out = await canvas
    .composite([{ input: mascot, gravity: "center" }])
    .png({ compressionLevel: 9 })
    .toBuffer();

  const outPath = join(OUT, name);
  await writeFile(outPath, out);
  console.log("wrote", outPath, `${out.length} bytes`);
}

async function makeAppIcon(size, outPath) {
  const mascot = await sharp(await readFile(SRC))
    .resize({
      width: Math.round(size * 0.78),
      height: Math.round(size * 0.78),
      fit: "inside",
    })
    .toBuffer();

  const canvas = sharp({
    create: { width: size, height: size, channels: 4, background: BG },
  });

  const out = await canvas
    .composite([{ input: mascot, gravity: "center" }])
    .png({ compressionLevel: 9 })
    .toBuffer();

  await writeFile(outPath, out);
  console.log("wrote", outPath, `${out.length} bytes`);
}

await mkdir(OUT, { recursive: true });
await makeIcon(192, "icon-192.png");
await makeIcon(512, "icon-512.png");
await makeIcon(512, "icon-maskable-512.png", { maskable: true });
await makeAppIcon(512, join(ROOT, "src", "app", "icon.png"));
console.log("done");
