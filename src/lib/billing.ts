import type { WorkspaceRecord } from "./types";

export const FREE_PLAN_PRICE_CENTS = 0;

export interface FreePlanStatus {
  plan: WorkspaceRecord["plan"];
  priceMonthlyCents: number;
  allFeaturesUnlocked: boolean;
  message: string;
}

export function getFreePlanStatus(): FreePlanStatus {
  return {
    plan: "free",
    priceMonthlyCents: FREE_PLAN_PRICE_CENTS,
    allFeaturesUnlocked: true,
    message: "SignalScout is 100% free with all channels, filters, and reply drafts unlocked.",
  };
}
