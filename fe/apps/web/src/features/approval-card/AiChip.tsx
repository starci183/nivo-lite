"use client";

import { Badge } from "@starci/grammar/common";

import { useT } from "@/i18n/client";
import { common } from "@/i18n/dict/common";

/**
 * Small "AI" chip that marks AI-prepared content; never the approval control itself.
 * A neutral Grammar Badge: "AI" is a category, not a status, and the Badge owns its paint (no app repaint class).
 */
export const AiChip = () => {
  const t = useT(common);
  return <Badge tone="neutral">{t("aiChip")}</Badge>;
};
