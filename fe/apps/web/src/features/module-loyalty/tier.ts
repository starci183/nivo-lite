import type { BadgeTone } from "@starci/grammar/common";
import { tierRank, type LoyaltyConfig } from "@/lib/module-loyalty-shared";

/** Badge tone climbs with the tier rank (the name is always written too, so colour is never the only signal). */
export const tierTone = (config: LoyaltyConfig, key: string | null): BadgeTone => {
  const rank = tierRank(config, key);
  if (rank <= 0) return "neutral";
  return rank === config.tiers.length - 1 ? "success" : "accent";
};
