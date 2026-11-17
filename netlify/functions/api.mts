import type { Config, Context } from "@netlify/functions";
import { getDb } from "../../src/lib/db";
import { handleApiRequest } from "../../src/lib/router";

export default async (req: Request, _context: Context) => {
  const db = getDb();
  return handleApiRequest(req, db);
};

export const config: Config = {
  path: "/api/*",
};
