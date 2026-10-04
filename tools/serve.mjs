import { createServer } from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = await fs.realpath(fileURLToPath(new URL("../", import.meta.url)));
const port = Number(process.argv[2] || 8080);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".mp4": "video/mp4",
  ".m4v": "video/mp4",
  ".webm": "video/webm",
  ".ogv": "video/ogg",
  ".ogg": "audio/ogg",
  ".oga": "audio/ogg",
  ".opus": "audio/opus",
  ".m4a": "audio/mp4",
  ".m4b": "audio/mp4",
  ".aac": "audio/aac",
  ".flac": "audio/flac",
  ".wav": "audio/wav",
  ".weba": "audio/webm",
  ".mov": "video/quicktime",
  ".mkv": "video/x-matroska",
  ".mp3": "audio/mpeg",
  ".woff2": "font/woff2",
};

const server = createServer(async (req, res) => {
  try {
    await handle(req, res);
  } catch (error) {
    if (res.headersSent) res.destroy();
    else res.writeHead(500).end("Internal server error");
  }
});

async function handle(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    res.writeHead(400).end("Invalid path");
    return;
  }

  // Windows also accepts backslashes and alternate data stream syntax.
  if (pathname.includes("\\") || /[:\x00]/.test(pathname) ||
      pathname.split("/").some((segment) => segment.startsWith("."))) {
    res.writeHead(403).end("Forbidden");
    return;
  }
  const filePath = path.resolve(root, `.${pathname}`);
  if (!isPublicPath(filePath)) {
    res.writeHead(403).end("Forbidden");
    return;
  }

  let stat;
  try {
    if (!isPublicPath(await fs.realpath(filePath))) {
      res.writeHead(403).end("Forbidden");
      return;
    }
    stat = await fs.stat(filePath);
  } catch {
    res.writeHead(404).end("Not found");
    return;
  }

  if (stat.isDirectory()) {
    const indexFile = path.join(filePath, "index.html");
    try {
      if (!isPublicPath(await fs.realpath(indexFile))) {
        res.writeHead(403).end("Forbidden");
        return;
      }
      const indexStat = await fs.stat(indexFile);
      return await sendFile(res, indexFile, indexStat, req.headers.range);
    } catch {
      const entries = await fs.readdir(filePath, { withFileTypes: true });
      const links = entries
        .filter((entry) => !entry.name.startsWith("."))
        .map((entry) => {
          const name = entry.isDirectory() ? `${entry.name}/` : entry.name;
          const href = `${pathname.endsWith("/") ? pathname : `${pathname}/`}${encodeURIComponent(entry.name)}${entry.isDirectory() ? "/" : ""}`;
          return `<li><a href="${escapeHtml(href)}">${escapeHtml(name)}</a></li>`;
        })
        .join("");
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end(
        `<!doctype html><meta charset="utf-8"><title>Index of ${escapeHtml(pathname)}</title><h1>Index of ${escapeHtml(pathname)}</h1><ul>${links}</ul>`
      );
      return;
    }
  }

  return sendFile(res, filePath, stat, req.headers.range);
}

function isPublicPath(filePath) {
  const rel = path.relative(root, filePath);
  return !path.isAbsolute(rel) &&
    !rel.split(path.sep).some((segment) => segment.startsWith("."));
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", '&#39;');
}

async function sendFile(res, filePath, stat, rangeHeader) {
  const mime = MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream";

  if (rangeHeader) {
    const match = /bytes=(\d*)-(\d*)/.exec(rangeHeader);
    let start;
    let end;

    if (match) {
      if (match[1] === "" && match[2] !== "") {
        start = Math.max(0, stat.size - Number(match[2]));
        end = stat.size - 1;
      } else {
        start = Number(match[1] || 0);
        end = match[2] ? Math.min(Number(match[2]), stat.size - 1) : stat.size - 1;
      }
    } else {
      start = 0;
      end = stat.size - 1;
    }

    if (Number.isNaN(start) || start >= stat.size || start > end) {
      res.writeHead(416, { "Content-Range": `bytes */${stat.size}` }).end();
      return;
    }

    res.writeHead(206, {
      "Content-Type": mime,
      "Content-Length": end - start + 1,
      "Content-Range": `bytes ${start}-${end}/${stat.size}`,
      "Accept-Ranges": "bytes",
      "Cache-Control": "no-cache",
    });
    const stream = (await import("node:fs")).createReadStream(filePath, { start, end });
    stream.pipe(res);
    stream.on("error", () => res.destroy());
    return;
  }

  res.writeHead(200, {
    "Content-Type": mime,
    "Content-Length": stat.size,
    "Accept-Ranges": "bytes",
    "Cache-Control": "no-cache",
  });
  const stream = (await import("node:fs")).createReadStream(filePath);
  stream.pipe(res);
  stream.on("error", () => res.destroy());
}

server.listen(port, "127.0.0.1", () => {
  console.log(`MusicPlayer dev server running at http://localhost:${server.address().port}`);
});
