"use client";

import { Badge } from "@starci/grammar/common";

import { useT } from "@/i18n/client";
import { common } from "@/i18n/dict/common";

/**
 * Small "AI" chip that marks AI-prepared content; never the approval control itself.
 * Brand V1.1 accent-ai: Signal Coral fill with ink text (styled by `.nivo-ai-chip` in src/app/brand.css).
 */
export const AiChip = () => {
  const t = useT(common);
  return (
    <span className="nivo-ai-chip">
      <Badge tone="neutral">{t("aiChip")}</Badge>
    </span>
  );
};
