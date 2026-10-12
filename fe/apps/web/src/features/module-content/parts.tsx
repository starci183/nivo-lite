"use client";

import { Badge, type BadgeTone } from "@starci/grammar/common";
import { useT } from "@/i18n/client";
import { content } from "@/i18n/dict/content";
import { channelRule, type ContentItem, type ContentStatus } from "@/lib/module-content-shared";

export const STATUS_TONE: Record<ContentStatus, BadgeTone> = { idea: "neutral", draft: "accent", waiting_approval: "warning", approved: "success", published: "success", skipped: "neutral" };

export const StatusBadge = ({ status }: { readonly status: ContentStatus }) => {
  const t = useT(content);
  return <Badge tone={STATUS_TONE[status]} isDot>{t(`status_${status}`)}</Badge>;
};

export const ChannelBadges = ({ channels }: { readonly channels: ContentItem["channels"] }) => (
  <>{channels.map((c) => <Badge key={c} tone="neutral">{channelRule(c).short}</Badge>)}</>
);

