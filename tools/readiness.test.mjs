import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { readFile, mkdtemp, writeFile, symlink, unlink, rmdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = fileURLToPath(new URL("../", import.meta.url));

for (const entry of ["serve.mjs", "dev-server.js"]) {
  test(`${entry}: public assets, ranges and restricted paths`, async () => {
    const child = spawn(process.execPath, [path.join(root, "tools", entry), "0"], {
      cwd: tmpdir(), stdio: ["ignore", "pipe", "pipe"],
    });
    const exited = once(child, "exit");
    try {
      const port = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("Server startup timed out")), 5000);
        child.once("error", (error) => { clearTimeout(timer); reject(error); });
        child.once("exit", (code) => { clearTimeout(timer); reject(new Error(`Server exited: ${code}`)); });
        child.stdout.once("data", (data) => {
          clearTimeout(timer);
          resolve(Number(String(data).match(/localhost:(\d+)/)[1]));
        });
      });
      const base = `http://127.0.0.1:${port}`;
      for (const resource of ["/", "/app.js", "/tracks/", "/docs/screenshot.png"]) {
        const response = await fetch(base + resource);
        assert.equal(response.status, 200, resource);
        await response.arrayBuffer();
      }
      for (const resource of ["/.git/config", "/%2egit/config", "/.htaccess",
        "/..%2f.git/config", "/..%5cREADME.md", "/README.md%3a%24DATA", "/%00"]) {
        const response = await fetch(base + resource);
        assert.equal(response.status, 403, resource);
        await response.arrayBuffer();
      }
      assert.equal((await fetch(base + "/%zz")).status, 400);
      const partial = await fetch(base + "/README.md", { headers: { Range: "bytes=0-3" } });
      assert.equal(partial.status, 206);
      assert.equal((await partial.arrayBuffer()).byteLength, 4);
      assert.equal((await fetch(base + "/README.md", {
        headers: { Range: "bytes=999999999-" },
      })).status, 416);

      // A directory junction must not expose files outside the repository.
      const outside = await mkdtemp(path.join(tmpdir(), "musicplayer-test-"));
      const link = path.join(root, `server-test-link-${port}`);
      let linked = false;
      try {
        await writeFile(path.join(outside, "private.txt"), "private");
        await symlink(outside, link, process.platform === "win32" ? "junction" : "dir");
        linked = true;
        assert.equal((await fetch(`${base}/${path.basename(link)}/private.txt`)).status, 403);
      } finally {
        if (linked) await unlink(link);
        await unlink(path.join(outside, "private.txt"));
        await rmdir(outside);
      }
    } finally {
      child.kill();
      await exited;
    }
  });
}

test("service worker only removes outdated caches belonging to its own scope", async () => {
  const source = await readFile(path.join(root, "service-worker.js"), "utf8");
  const scope = "https://example.test/MusicPlayer/";
  const prefix = `mp-${encodeURIComponent(scope)}-`;
  const unrelated = ["another-app-v1", "mp-shell-v13",
    `mp-${encodeURIComponent("https://example.test/OtherPlayer/")}-shell-v1`];
  const current = ["shell", "runtime", "audio"].map((type) => `${prefix}${type}-v14`);
  const old = `${prefix}shell-v12`;
  const deleted = [];
  const listeners = {};
  let claimed = false;
  vm.runInNewContext(source, {
    self: {
      registration: { scope },
      addEventListener: (name, callback) => { listeners[name] = callback; },
      clients: { claim: async () => { claimed = true; } },
    },
    caches: {
      keys: async () => [...unrelated, ...current, old],
      delete: async (name) => { deleted.push(name); return true; },
    },
  });
  let completed;
  listeners.activate({ waitUntil: (promise) => { completed = promise; } });
  await completed;
  assert.deepEqual(deleted, [old]);
  assert.equal(claimed, true);
});
