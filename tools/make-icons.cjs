"use strict";
const zlib = require("zlib");
const fs = require("fs");

function crc32(buf) {
  let table = crc32.t;
  if (!table) {
    table = crc32.t = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (const b of buf) c = table[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const t = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crcBuf]);
}

function roundedBar(x, y, x0, x1, y0, y1, r) {
  if (y < y0 || y > y1) return false;
  if (y < y0 + r) {
    // top corners: circle of radius r around (x0+r, y0+r) and (x1-r, y0+r)
    const cxL = x0 + r;
    const cxR = x1 - r;
    const cy = y0 + r;
    const distL = (x - cxL) ** 2 + (y - cy) ** 2;
    const distR = (x - cxR) ** 2 + (y - cy) ** 2;
    return distL <= r * r || distR <= r * r || (x > cxL && x < cxR);
  }
  return true;
}

function png(size, maskable, path) {
  const w = size;
  const h = size;
  const raw = Buffer.alloc(h * (1 + w * 4));
  const acc = [0x2f, 0xd4, 0xb0];
  const barBottomFrac = 0.74;
  const heights = [0.34, 0.24, 0.46, 0.56, 0.4];
  const maskPad = maskable ? 0.22 : 0.16;
  const span = 1 - maskPad * 2;
  const bars = heights.length;
  const bw = (span / (bars * 2 - 1)) * w;
  const rr = Math.min(bw / 2, size * 0.05);

  for (let y = 0; y < h; y++) {
    const row = y * (1 + w * 4);
    raw[row] = 0;
    for (let x = 0; x < w; x++) {
      let r = 0x0e, g = 0x0e, b = 0x11;
      for (let i = 0; i < bars; i++) {
        const cx0 = w * maskPad + i * bw * 2;
        const cx1 = cx0 + bw;
        if (x >= cx0 - 1 && x <= cx1 + 1) {
          const bh = heights[i] * h;
          const by1 = h * barBottomFrac;
          const by0 = by1 - bh;
          if (roundedBar(x, y, cx0, cx1, by0, by1, rr)) {
            r = acc[0]; g = acc[1]; b = acc[2];
          }
        }
      }
      const p = row + 1 + x * 4;
      raw[p] = r; raw[p + 1] = g; raw[p + 2] = b; raw[p + 3] = 0xff;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const out = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  fs.writeFileSync(path, out);
}

png(192, false, "icons/icon-192.png");
png(512, false, "icons/icon-512.png");
png(512, true, "icons/icon-512-maskable.png");
console.log("icons written");
