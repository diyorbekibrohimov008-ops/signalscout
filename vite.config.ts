import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

function localApiDevPlugin(): Plugin {
  let sharedDb: unknown = null;

  return {
    name: "signalscout-local-api",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/api", async (req, res, next) => {
        try {
          const [{ handleApiRequest }, { MemoryDb }] = await Promise.all([
            server.ssrLoadModule("/src/lib/router.ts"),
            server.ssrLoadModule("/src/lib/db.ts"),
          ]);
          if (!sharedDb) {
            sharedDb = new MemoryDb();
          }

          const chunks: Buffer[] = [];
          for await (const chunk of req) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          }
          const bodyBuffer = chunks.length > 0 ? Buffer.concat(chunks) : undefined;
          const host = req.headers.host || "localhost:5173";
          const url = `http://${host}${req.originalUrl || req.url || "/api/health"}`;

          const headers = new Headers();
          for (const [k, v] of Object.entries(req.headers)) {
            if (Array.isArray(v)) {
              for (const item of v) headers.append(k, item);
            } else if (typeof v === "string") {
              headers.set(k, v);
            }
          }

          const method = (req.method || "GET").toUpperCase();
          const webReq = new Request(url, {
            method,
            headers,
            body: method === "GET" || method === "HEAD" ? undefined : bodyBuffer,
          });

          const webRes: Response = await handleApiRequest(webReq, sharedDb);
          res.statusCode = webRes.status;
          const setCookies =
            typeof webRes.headers.getSetCookie === "function" ? webRes.headers.getSetCookie() : [];
          webRes.headers.forEach((value, key) => {
            if (key.toLowerCase() === "set-cookie") return;
            res.setHeader(key, value);
          });
          if (setCookies.length > 0) {
            res.setHeader("set-cookie", setCookies);
          }
          const out = Buffer.from(await webRes.arrayBuffer());
          res.end(out);
        } catch (err) {
          next(err);
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), localApiDevPlugin()],
});
