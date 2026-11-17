import type { Config } from "@netlify/functions";
import { getDb } from "../../src/lib/db";
import { runMonitorScan } from "../../src/lib/pipeline";

export default async (req: Request) => {
  const startedAt = Date.now();
  const payload = (await req.json().catch(() => ({}))) as { next_run?: string };
  const db = getDb();
  const targets = await db.listAllActiveMonitors();

  let scanned = 0;
  let totalAlerts = 0;
  for (const { monitor, workspace } of targets) {
    // Stay well within Netlify's 30s scheduled function timeout
    if (Date.now() - startedAt > 22_000) break;
    const run = await runMonitorScan(db, workspace, monitor, {
      triggerType: "cron",
      includeSimulation: false,
    });
    scanned++;
    totalAlerts += run.alertsDispatched;
  }

  console.log(
    JSON.stringify({
      event: "cron_poll_complete",
      scannedMonitors: scanned,
      totalAlerts,
      nextRun: payload.next_run ?? null,
      durationMs: Date.now() - startedAt,
    }),
  );
};

export const config: Config = {
  schedule: "*/10 * * * *",
};
