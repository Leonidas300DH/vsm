import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { configuration, callProvider } from "./adapters.mjs";
import { validateProposal } from "../src/services/proposals.js";
const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../dist",
);
export function createLocalServer({
  env = process.env,
  fetchImpl = fetch,
  timeoutMs = 60000,
} = {}) {
  let busy = false;
  return http.createServer(async (req, res) => {
    const send = (status, data) => {
      if (!res.destroyed) {
        res.writeHead(status, {
          "content-type": "application/json",
          "cache-control": "no-store",
          "X-Content-Type-Options": "nosniff",
        });
        res.end(JSON.stringify(data));
      }
    };
    if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.headers.host || ""))
      return send(403, { error: "Hôte local requis." });
    const origin = req.headers.origin;
    if (
      origin &&
      ![
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        "http://127.0.0.1:8787",
        "http://localhost:8787",
      ].includes(origin)
    )
      return send(403, { error: "Origine non autorisée." });
    if (req.url === "/api/config" && req.method === "GET")
      return send(200, configuration(env));
    if (req.url === "/api/analyze" && req.method === "POST") {
      if (!configuration(env).enabled)
        return send(403, {
          error: "Appels IA désactivés dans cette installation.",
        });
      if (
        req.headers["x-vsm-request"] !== "analysis" ||
        !req.headers["content-type"]?.startsWith("application/json")
      )
        return send(400, { error: "Requête explicite JSON requise." });
      if (busy) return send(409, { error: "Une analyse est déjà en cours." });
      busy = true;
      const controller = new AbortController();
      res.on("close", () => {
        if (!res.writableEnded) controller.abort();
      });
      try {
        let size = 0,
          parts = [];
        for await (const part of req) {
          size += part.length;
          if (size > 2_000_000) throw new Error("Dossier trop volumineux.");
          parts.push(part);
        }
        let input;
        try {
          input = JSON.parse(Buffer.concat(parts).toString());
        } catch {
          throw new Error("Requête JSON invalide.");
        }
        if (
          !input.package?.source ||
          !Array.isArray(input.package.scenario?.nodes) ||
          !Array.isArray(input.package.scenario?.edges)
        )
          throw new Error("Dossier d’analyse invalide.");
        const result = await callProvider(
          input.provider,
          input.model,
          input.package,
          env,
          { fetchImpl, signal: controller.signal, timeoutMs },
        );
        const validation = validateProposal(result, {
          ...input.package.scenario,
          ...input.package.source,
          id: input.package.source.scenarioId,
        });
        if (!validation.ok)
          throw new Error(
            "Proposition non conforme : " + validation.errors.join(" "),
          );
        send(200, result);
      } catch (error) {
        send(400, { error: error.message });
      } finally {
        busy = false;
      }
      return;
    }
    if (req.url?.startsWith("/api/"))
      return send(404, { error: "Route inconnue." });
    if (req.method !== "GET")
      return send(405, { error: "Méthode non autorisée." });
    try {
      const url = new URL(req.url, "http://localhost"),
        relative =
          decodeURIComponent(url.pathname) === "/"
            ? "index.html"
            : decodeURIComponent(url.pathname).slice(1);
      const file = path.resolve(root, relative);
      if (!file.startsWith(root + path.sep))
        return send(403, { error: "Chemin interdit." });
      const body = await fs.readFile(file);
      const mime =
        {
          ".html": "text/html",
          ".js": "text/javascript",
          ".css": "text/css",
          ".svg": "image/svg+xml",
          ".png": "image/png",
        }[path.extname(file)] || "application/octet-stream";
      res.writeHead(200, {
        "content-type": mime,
        "X-Content-Type-Options": "nosniff",
      });
      res.end(body);
    } catch {
      send(404, { error: "Fichier absent. Exécuter npm run build." });
    }
  });
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  createLocalServer().listen(8787, "127.0.0.1", () =>
    console.log("VSM local : http://127.0.0.1:8787 - aucune clé affichée."),
  );
}
