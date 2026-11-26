import { getDb } from "../src/lib/db";
import { handleApiRequest } from "../src/lib/router";

async function dispatch(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const routeParam = url.searchParams.get("__route");
  if (
    routeParam !== null &&
    (url.pathname === "/api/index" || url.pathname === "/api/vercel" || url.pathname === "/api")
  ) {
    url.pathname = `/api/${routeParam}`.replace(/\/+$/, "") || "/api";
    url.searchParams.delete("__route");
    const forwarded = new Request(url.toString(), {
      method: req.method,
      headers: req.headers,
      body: req.method === "GET" || req.method === "HEAD" ? undefined : req.body,
      // @ts-expect-error Node 24 duplex streaming option when body is a stream
      duplex: "half",
    });
    return handleApiRequest(forwarded, getDb());
  }
  return handleApiRequest(req, getDb());
}

export async function GET(req: Request): Promise<Response> {
  return dispatch(req);
}

export async function POST(req: Request): Promise<Response> {
  return dispatch(req);
}

export async function PATCH(req: Request): Promise<Response> {
  return dispatch(req);
}

export async function PUT(req: Request): Promise<Response> {
  return dispatch(req);
}

export async function DELETE(req: Request): Promise<Response> {
  return dispatch(req);
}
