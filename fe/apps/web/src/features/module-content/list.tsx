"use client";

import { useState } from "react";
import { EmptyNotice, HorizontalScrollRegion, ListBox, SegmentedControl, SurfaceCard, Text } from "@starci/grammar/common";
import { useT } from "@/i18n/client";
import { content } from "@/i18n/dict/content";
import { CONTENT_STATUSES, type ContentItem, type ContentStatus, type Pillar } from "@/lib/module-content-shared";
import { CHIPS_CLASS_NAME } from "./classNames";
import { dateText, timeText } from "./format";
import { ChannelBadges, StatusBadge } from "./parts";

export type ListPanelProps = {
  readonly items: ReadonlyArray<ContentItem>;
  readonly pillars: ReadonlyArray<Pillar>;
  readonly onOpen: (id: string) => void;
};

/** All posts, soonest first, with a status filter; each row opens the post (ListBox, actionable rows). */
export const ListPanel = ({ items, pillars, onOpen }: ListPanelProps) => {
  const t = useT(content);
  const [filter, setFilter] = useState<"all" | ContentStatus>("all");
  const shown = items.filter((i) => filter === "all" || i.status === filter).sort((a, b) => (a.scheduled_at ?? "9999").localeCompare(b.scheduled_at ?? "9999"));
  const options = [{ value: "all", label: t("filterAll") }, ...CONTENT_STATUSES.map((s) => ({ value: s, label: `${t(`status_${s}`)} (${items.filter((i) => i.status === s).length})` }))];
  const rows = shown.map((i) => {
    const pillar = pillars.find((p) => p.id === i.pillar_id);
    return {
      id: i.id,
      label: i.title,
      description: (
        <>
          <Text as="span" size="xs" tone="muted">{i.scheduled_at ? `${dateText(i.scheduled_at)} · ${timeText(i.scheduled_at)}` : t("noDate")}</Text>
          {i.brief ? <Text as="span" size="sm" tone="muted" overflow="clamp-2">{i.brief}</Text> : null}
          <span className={CHIPS_CLASS_NAME}>
            <ChannelBadges channels={i.channels} />
            <Text as="span" size="xs" tone="muted">{pillar?.name ?? t("noPillar")}</Text>
          </span>
        </>
      ),
      trailing: <StatusBadge status={i.status} />,
    };
  });
  return (
    <>
      <HorizontalScrollRegion overflow="needed" isFocusable={false}>
        <SegmentedControl label={t("tabList")} isLabelHidden options={options} value={filter} onValueChange={(v) => setFilter(v as "all" | ContentStatus)} />
      </HorizontalScrollRegion>
      <SurfaceCard ariaLabel={t("tabList")}>
        {shown.length === 0 ? <EmptyNotice message={t("listEmptyTitle")} description={t("listEmptyBody")} /> : (
          <ListBox label={t("tabList")} items={rows} selectionMode="none" onAction={onOpen} />
        )}
      </SurfaceCard>
    </>
  );
};
