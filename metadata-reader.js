"use strict";

/* Minimal in-browser audio tag reader: ID3v2.2/2.3/2.4 (+ID3v1 fallback),
   FLAC (VORBIS_COMMENT + PICTURE), Ogg (OpusTags / vorbis comments)
   and MP4/M4A ilst atoms. No dependencies. */

const MetadataReader = (function () {
  const latin1Decoder = new TextDecoder("windows-1252");
  const utf8Decoder = new TextDecoder("utf-8");
  const utf16LEDecoder = new TextDecoder("utf-16le");
  const utf16BEDecoder = new TextDecoder("utf-16be");

  function latin1(bytes) {
    return latin1Decoder.decode(bytes);
  }

  function decodeTextBytes(data, fallbackText = "") {
    return decodeText(data.subarray(1), data[0]);
  }

  function decodeText(bytes, encoding) {
    try {
      let value;
      if (encoding === 1) {
        const le = bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe;
        value = (le ? utf16LEDecoder : utf16BEDecoder).decode(bytes);
      } else if (encoding === 2) {
        value = utf16BEDecoder.decode(bytes);
      } else if (encoding === 3) {
        value = utf8Decoder.decode(bytes);
      } else {
        value = latin1(bytes);
      }
      return value.replace(/[\u0000\s]+$/g, "").replace(/^[\u0000\s]+/g, "").trim();
    } catch {
      return "";
    }
  }

  function ascii(bytes, offset, length) {
    let out = "";
    for (let i = 0; i < length && offset + i < bytes.length; i++) {
      out += String.fromCharCode(bytes[offset + i]);
    }
    return out;
  }

  function syncsafe(bytes, offset) {
    return (
      ((bytes[offset] & 0x7f) << 21) |
      ((bytes[offset + 1] & 0x7f) << 14) |
      ((bytes[offset + 2] & 0x7f) << 7) |
      (bytes[offset + 3] & 0x7f)
    );
  }

  function u24(bytes, offset) {
    return (bytes[offset] << 16) | (bytes[offset + 1] << 8) | bytes[offset + 2];
  }

  function u32be(bytes, offset) {
    return (
      ((bytes[offset] << 24) |
        (bytes[offset + 1] << 16) |
        (bytes[offset + 2] << 8) |
        bytes[offset + 3]) >>> 0
    );
  }

  function parseID3v2(bytes) {
    if (ascii(bytes, 0, 3) !== "ID3") return null;
    const major = bytes[3];
    const flags = bytes[5];
    const tagSize = syncsafe(bytes, 6);
    const tagEnd = Math.min(10 + tagSize, bytes.byteLength);
    let pos = 10;
    const info = {};
    let art = null;

    if (flags & 0x40) {
      pos += major === 3 ? 4 + u32be(bytes, 10) : syncsafe(bytes, 10);
    }

    const idLen = major === 2 ? 3 : 4;
    const headLen = major === 2 ? 6 : 10;

    while (pos + headLen <= tagEnd) {
      const id = ascii(bytes, pos, idLen);
      if (!/^[A-Z0-9]{3,4}$/.test(id)) break;
      let frameSize;
      if (major === 2) {
        frameSize = u24(bytes, pos + 3);
      } else if (major === 4) {
        frameSize = syncsafe(bytes, pos + 4);
      } else {
        frameSize = u32be(bytes, pos + 4);
      }
      if (frameSize <= 0 || pos + headLen + frameSize > bytes.byteLength) break;
      const dataStart = pos + headLen;
      const dataEnd = Math.min(dataStart + frameSize, tagEnd);
      const data = bytes.subarray(dataStart, dataEnd);

      try {
        switch (id) {
          case "TIT2":
          case "TT2":
            info.title = decodeText(data.subarray(1), data[0]).trim();
            break;
          case "TPE1":
          case "TP1":
            info.artist = decodeText(data.subarray(1), data[0]).trim();
            break;
          case "TPE2":
          case "TP2":
            info.albumArtist = decodeText(data.subarray(1), data[0]).trim();
            break;
          case "TALB":
          case "TAL":
            info.album = decodeText(data.subarray(1), data[0]).trim();
            break;
          case "TDRC":
          case "TYER":
          case "TDAT":
            info.year = decodeText(data.subarray(1), data[0]).trim().slice(0, 10);
            break;
          case "APIC": {
            const pic = readApic(data, false);
            if (pic) info.art = pic;
            break;
          }
          case "PIC": {
            const pic = readApic(data, true);
            if (pic) info.art = pic;
            break;
          }
          default:
            break;
        }
      } catch {
        // malformed frame — skip
      }
      pos = dataEnd;
    }

    return info;
  }

  function readApic(data, oldFormat) {
    let i = 0;
    const encoding = data[i++];
    let mime = "image/jpeg";
    if (oldFormat) {
      const code = ascii(data, i, 3).toLowerCase();
      mime = "image/" + (code === "jpg" ? "jpeg" : code);
      i += 3;
    } else {
      const mimeStart = i;
      while (i < data.length && data[i] !== 0) i++;
      const parsed = latin1(data.subarray(mimeStart, i)).trim();
      mime = parsed || "image/jpeg";
      i++;
    }
    i++; // picture type
    const unit = encoding === 1 || encoding === 2 ? 2 : 1;
    while (i < data.length - unit) {
      let terminator = true;
      for (let j = 0; j < unit; j++) {
        if (data[i + j] !== 0) terminator = false;
      }
      if (terminator) break;
      i += unit;
    }
    i += unit;
    if (i >= data.length) return null;
    return { mime, bytes: data.subarray(i) };
  }

  function parseID3v1(bytes) {
    if (bytes.byteLength < 128) return null;
    const tail = bytes.subarray(bytes.byteLength - 128);
    if (ascii(tail, 0, 3) !== "TAG") return null;
    const field = (start, end) => latin1(tail.subarray(start, end)).replace(/[\u0000\s]+$/g, "");
    return {
      title: field(3, 33),
      artist: field(33, 63),
      album: field(63, 93),
      year: field(93, 97).trim(),
      art: null,
    };
  }

  function parseFlacPicture(data) {
    let i = 4; // picture type
    const mimeLen = u32be(data, i);
    i += 4;
    const mime = latin1(data.subarray(i, i + mimeLen)) || "image/jpeg";
    i += mimeLen;
    const descLen = u32be(data, i);
    i += 4 + descLen;
    i += 16; // width, height, depth, colors
    const dataLen = u32be(data, i);
    i += 4;
    const imageBytes = data.subarray(i, i + dataLen);
    if (!imageBytes.length) return null;
    return { mime, bytes: imageBytes };
  }

  function vorbisCommentsToInfo(comments, art) {
    const find = (key) => {
      const found = comments.find((c) => c.toUpperCase().startsWith(key + "="));
      return found ? found.slice(key.length + 1) : "";
    };
    return {
      title: find("TITLE"),
      artist: find("ARTIST") || find("ALBUMARTIST"),
      album: find("ALBUM"),
      year: find("DATE").slice(0, 10),
      art: art || null,
    };
  }

  function parseVorbisCommentSection(body, offset) {
    const comments = [];
    let i = offset;
    const vendorLen = u32be(body, i);
    i += 4 + vendorLen;
    const count = Math.min(u32be(body, i), 1024);
    i += 4;
    for (let k = 0; k < count && i + 4 <= body.byteLength; k++) {
      const len = u32be(body, i);
      i += 4;
      if (i + len > body.byteLength) break;
      comments.push(utf8Decoder.decode(body.subarray(i, i + len)));
      i += len;
    }
    return comments;
  }

  function parseFlac(bytes) {
    if (ascii(bytes, 0, 4) !== "fLaC") return null;
    let pos = 4;
    let comments = null;
    let art = null;

    for (;;) {
      if (pos + 4 > bytes.byteLength) break;
      const header = bytes[pos];
      const type = header & 0x7f;
      const last = Boolean(header & 0x80);
      const size = u24(bytes, pos + 1);
      if (size < 0 || pos + 4 + size > bytes.byteLength) break;
      const body = bytes.subarray(pos + 4, pos + 4 + size);
      if (type === 4) {
        try {
          comments = parseVorbisCommentSection(body, 0);
        } catch {
          comments = null;
        }
      } else if (type === 6) {
        try {
          art = parseFlacPicture(body);
        } catch {
          // ignore
        }
      }
      pos += 4 + size;
      if (last) break;
    }
    if (!comments && !art) return null;
    return vorbisCommentsToInfo(comments || [], art);
  }

  function findAsciiSequence(bytes, text) {
    const needle = new Uint8Array(text.length);
    for (let i = 0; i < text.length; i++) {
      needle[i] = text.charCodeAt(i) & 0xff;
    }
    outer: for (let i = 0; i <= bytes.byteLength - needle.length; i++) {
      for (let j = 0; j < needle.length; j++) {
        if (bytes[i + j] !== needle[j]) continue outer;
      }
      return i;
    }
    return -1;
  }

  function parseOgg(bytes) {
    const opusAt = findAsciiSequence(bytes, "OpusTags");
    const vorbisAt = findAsciiSequence(bytes, "\u0003vorbis");
    let mark = -1;
    if (opusAt >= 0) mark = opusAt + 8;
    else if (vorbisAt >= 0) mark = vorbisAt + 7;
    if (mark < 0) return null;

    try {
      const comments = parseVorbisCommentSection(bytes, mark);
      let art = null;
      const picture = comments.find((c) => c.toUpperCase().startsWith("METADATA_BLOCK_PICTURE="));
      if (picture) {
        const raw = picture.slice("=".length + "METADATA_BLOCK_PICTURE".length);
        const bin = atob(raw);
        const imgBytes = new Uint8Array(bin.length);
        for (let j = 0; j < bin.length; j++) imgBytes[j] = bin.charCodeAt(j);
        art = parseFlacPicture(imgBytes);
      }
      if (!comments.length && !art) return null;
      return vorbisCommentsToInfo(comments, art);
    } catch {
      return null;
    }
  }

  function parseM4a(bytes) {
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let ilist = null;
    const readAtoms = (start, end, depth) => {
      let p = start;
      while (p + 8 <= end) {
        let size = dv.getUint32(p);
        const type = ascii(bytes, p + 4, 4);
        if (size === 1) return;
        if (size < 8) break;
        const bodyEnd = Math.min(p + size, end);
        if (["moov", "udta", "meta", "ilst"].indexOf(type) !== -1 && depth < 5) {
          const innerStart = type === "meta" ? p + 12 : p + 8;
          if (type === "ilst") {
            ilist = { start: innerStart, end: bodyEnd };
            break;
          }
          readAtoms(innerStart, bodyEnd, depth + 1);
        }
        p = p + size;
      }
    };
    readAtoms(0, bytes.byteLength, 0);
    if (!ilist) return null;

    const info = {};
    let art = null;
    let p = ilist.start;
    while (p + 8 <= ilist.end) {
      const size = dv.getUint32(p);
      if (size < 8) break;
      const type = ascii(bytes, p + 4, 4);
      const bodyEnd = Math.min(p + size, ilist.end);
      let q = p + 8;
      while (q + 8 <= bodyEnd) {
        const dataSize = dv.getUint32(q);
        if (dataSize < 8 || ascii(bytes, q + 4, 4) !== "data") break;
        const payload = bytes.subarray(q + 16, q + dataSize);
        try {
          switch (type) {
            case "\u00a9nam":
              info.title = utf8Decoder.decode(payload).trim();
              break;
            case "\u00a9ART":
              info.artist = utf8Decoder.decode(payload).trim();
              break;
            case "\u00a9alb":
              info.album = utf8Decoder.decode(payload).trim();
              break;
            case "\u00a9day":
              info.year = utf8Decoder.decode(payload).trim().slice(0, 10);
              break;
            case "covr": {
              art = {
                mime: payload[0] === 0x89 || payload[1] === 0x50 ? "image/png" : "image/jpeg",
                bytes: payload,
              };
              break;
            }
            default:
              break;
          }
        } catch {
          // ignore
        }
        q = q + dataSize;
      }
      p = bodyEnd;
    }
    if (!info.title && !info.artist && !info.album && !art) return null;
    info.art = art;
    return info;
  }

  async function readTags(source) {
    let bytes;
    try {
      if (source instanceof Blob) {
        bytes = new Uint8Array(await source.arrayBuffer());
      } else {
        const response = await fetch(source, { cache: "force-cache" });
        if (!response.ok) return null;
        bytes = new Uint8Array(await response.arrayBuffer());
      }
    } catch {
      return null;
    }

    let tags = null;
    try {
      const type4 = ascii(bytes, 0, 4);
      const type3 = ascii(bytes, 0, 3);
      if (type3 === "ID3") {
        tags = parseID3v2(bytes);
        if (tags && !tags.title && !tags.artist && !tags.album) {
          tags = parseID3v1Fallback(bytes, tags);
        }
      } else if (type4 === "fLaC") {
        tags = parseFlac(bytes);
      } else if (type4 === "OggS") {
        tags = parseOgg(bytes);
      } else if (ascii(bytes, 4, 4) === "ftyp") {
        tags = parseM4a(bytes);
      } else {
        tags = parseID3v1(bytes);
      }
    } catch {
      tags = null;
    }
    return tags && (tags.title || tags.artist || tags.album || tags.art) ? tags : null;
  }

  function parseID3v1Fallback(bytes, tags) {
    const v1 = parseID3v1(bytes);
    if (!v1) return tags;
    if (!tags.title && v1.title) tags.title = v1.title;
    if (!tags.artist && v1.artist) tags.artist = v1.artist;
    if (!tags.album && v1.album) tags.album = v1.album;
    if (!tags.year && v1.year) tags.year = v1.year;
    return tags;
  }

  function artBytesToUrl(art) {
    if (!art || !art.bytes) return "";
    const blob = new Blob([art.bytes], { type: art.mime || "image/jpeg" });
    return URL.createObjectURL(blob);
  }

  return { readTags, artBytesToUrl, _debug: { parseID3v2, parseID3v1, parseFlac, parseOgg, parseM4a, ascii } };
})();

function readTrackTags(source) {
  return MetadataReader.readTags(source);
}

function tagsArtToUrl(tags) {
  if (!tags || !tags.art) return "";
  try {
    return MetadataReader.artBytesToUrl(tags.art);
  } catch {
    return "";
  }
}
