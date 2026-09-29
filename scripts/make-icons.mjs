// Generates the extension's PNG icons (blue rounded square with a white check mark)
// without any image libraries. Run: node scripts/make-icons.mjs
import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function icon(size) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  const r = size * 0.22; // corner radius
  const stroke = size * 0.1;
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const px = x + 0.5, py = y + 0.5;
      // rounded-square coverage
      const cx = Math.min(Math.max(px, r), size - r), cy = Math.min(Math.max(py, r), size - r);
      const inside = Math.hypot(px - cx, py - cy) <= r;
      // check mark
      const d = Math.min(
        distToSegment(px, py, size * 0.27, size * 0.52, size * 0.43, size * 0.68),
        distToSegment(px, py, size * 0.43, size * 0.68, size * 0.74, size * 0.34),
      );
      const onCheck = d <= stroke / 2;
      const i = y * (size * 4 + 1) + 1 + x * 4;
      if (!inside) continue; // transparent
      const [R, G, B] = onCheck ? [255, 255, 255] : [31, 111, 235];
      raw[i] = R; raw[i + 1] = G; raw[i + 2] = B; raw[i + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

for (const size of [16, 48, 128]) {
  writeFileSync(new URL(`../extension/public/icons/icon${size}.png`, import.meta.url), icon(size));
}
console.log("Icons written to extension/public/icons/");
