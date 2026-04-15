import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(fileURLToPath(new URL("..", import.meta.url)), "public");
const wordsFile = process.env.WORDBOOK_WORDS_FILE || join(fileURLToPath(new URL("..", import.meta.url)), "data", "words.json");
const port = process.env.PORT || 3000;

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".webmanifest": "application/manifest+json; charset=utf-8",
};

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

async function readJsonBody(req) {
  let body = "";

  for await (const chunk of req) {
    body += chunk;

    if (body.length > 10000) {
      throw new Error("Request body is too large.");
    }
  }

  return body ? JSON.parse(body) : {};
}

async function readWords() {
  try {
    const file = await readFile(wordsFile, "utf8");
    const parsed = JSON.parse(file);

    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

async function writeWords(words) {
  await mkdir(dirname(wordsFile), { recursive: true });
  await writeFile(wordsFile, JSON.stringify(words, null, 2), "utf8");
}

function createWord(payload) {
  const spanish = normalizeText(payload.spanish);
  const meaning = normalizeText(payload.meaning);
  const note = normalizeText(payload.note);

  if (!spanish || !meaning) {
    return null;
  }

  return {
    id: randomUUID(),
    spanish,
    meaning,
    note,
    createdAt: new Date().toISOString(),
  };
}

function resolvePublicPath(url = "/") {
  const pathname = new URL(url, "http://localhost").pathname;
  const requestedPath = pathname === "/" ? "/index.html" : pathname;
  const safePath = normalize(decodeURIComponent(requestedPath)).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(root, safePath);

  return filePath.startsWith(root) ? filePath : join(root, "index.html");
}

async function serveWordsApi(req, res, pathname) {
  try {
    if (req.method === "GET" && pathname === "/api/words") {
      const words = await readWords();
      sendJson(res, 200, { words });
      return true;
    }

    if (req.method === "POST" && pathname === "/api/words") {
      const payload = await readJsonBody(req);
      const word = createWord(payload);

      if (!word) {
        sendJson(res, 400, { error: "Spanish word and meaning are required." });
        return true;
      }

      const words = await readWords();
      const alreadySaved = words.some(
        (item) => item.spanish.toLowerCase() === word.spanish.toLowerCase()
      );

      if (alreadySaved) {
        sendJson(res, 409, { error: "That word is already in your WordBook." });
        return true;
      }

      const nextWords = [word, ...words];
      await writeWords(nextWords);
      sendJson(res, 201, { word });
      return true;
    }

    if (req.method === "DELETE" && pathname.startsWith("/api/words/")) {
      const id = decodeURIComponent(pathname.replace("/api/words/", ""));
      const words = await readWords();
      const nextWords = words.filter((word) => word.id !== id);

      if (nextWords.length === words.length) {
        sendJson(res, 404, { error: "Word not found." });
        return true;
      }

      await writeWords(nextWords);
      sendJson(res, 200, { ok: true });
      return true;
    }

    if (pathname.startsWith("/api/words")) {
      sendJson(res, 405, { error: "Method not allowed." });
      return true;
    }
  } catch (error) {
    const statusCode = error instanceof SyntaxError ? 400 : 500;
    const message = statusCode === 400 ? "Invalid JSON request body." : "WordBook storage failed.";
    sendJson(res, statusCode, { error: message });
    return true;
  }

  return false;
}

async function serve(req, res) {
  const { pathname } = new URL(req.url, "http://localhost");

  if (await serveWordsApi(req, res, pathname)) {
    return;
  }

  let filePath = resolvePublicPath(req.url);

  if (!existsSync(filePath) || extname(filePath) === "") {
    filePath = join(root, "index.html");
  }

  try {
    const file = await readFile(filePath);
    const contentType = contentTypes[extname(filePath)] || "application/octet-stream";

    res.writeHead(200, { "Content-Type": contentType });
    res.end(file);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
}

export default serve;

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  createServer(serve).listen(port, () => {
    console.log(`WordBook running at http://localhost:${port}`);
  });
}
