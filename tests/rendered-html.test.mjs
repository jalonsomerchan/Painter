import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the Pausa loading shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html lang="es">/i);
  assert.match(html, /<title>Pausa — pinta despacio<\/title>/i);
  assert.match(html, /class="app-shell loading-shell"/);
  assert.match(html, /class="leaf-mark"/);
  assert.match(html, /href="\/favicon\.svg"/);
  assert.doesNotMatch(html, /starter|Your site is taking shape/i);
});

test("keeps saved progress and motion preferences in the game bundle", async () => {
  const [game, css] = await Promise.all([
    readFile(new URL("../app/painter-game.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(game, /pausa-painter-v1/);
  assert.match(game, /localStorage\.setItem/);
  assert.match(game, /difficulty:\s*"medium"/);
  assert.match(game, /brushSize:\s*"medium"/);
  assert.match(game, /function scoreKey/);
  assert.match(game, /const resetLevel/);
  assert.match(css, /\.loading-shell\s*\{/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
});
