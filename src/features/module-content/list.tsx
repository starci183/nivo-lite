"use client";

import { useState } from "react";
import { EmptyNotice, SegmentedControl, SurfaceCard, Text } from "@starci/grammar/common";
import { useT } from "@/i18n/client";
import { content } from "@/i18n/dict/content";
import { CONTENT_STATUSES, type ContentItem, type ContentStatus, type Pillar } from "@/lib/module-content-shared";
import { CHIPS_CLASS_NAME, LIST_CLASS_NAME, ROW_BUTTON_CLASS_NAME, ROW_CLASS_NAME, ROW_MAIN_CLASS_NAME } from "./classNames";
import { dateText, timeText } from "./format";
import { ChannelBadges, StatusBadge } from "./parts";

export type ListPanelProps = {
  readonly items: ReadonlyArray<ContentItem>;
  readonly pillars: ReadonlyArray<Pillar>;
  readonly onOpen: (id: string) => void;
};

/** All posts, soonest first, with a status filter. */
export const ListPanel = ({ items, pillars, onOpen }: ListPanelProps) => {
  const t = useT(content);
  const [filter, setFilter] = useState<"all" | ContentStatus>("all");
  const shown = items.filter((i) => filter === "all" || i.status === filter).sort((a, b) => (a.scheduled_at ?? "9999").localeCompare(b.scheduled_at ?? "9999"));
  const options = [{ value: "all", label: t("filterAll") }, ...CONTENT_STATUSES.map((s) => ({ value: s, label: `${t(`status_${s}`)} (${items.filter((i) => i.status === s).length})` }))];
  return (
    <>
      <div className="max-w-full overflow-x-auto">
        <SegmentedControl label={t("tabList")} isLabelHidden options={options} value={filter} onValueChange={(v) => setFilter(v as "all" | ContentStatus)} />
      </div>
      <SurfaceCard ariaLabel={t("tabList")}>
        {shown.length === 0 ? <EmptyNotice message={t("listEmptyTitle")} description={t("listEmptyBody")} /> : (
          <ul className={LIST_CLASS_NAME}>
            {shown.map((i) => {
              const pillar = pillars.find((p) => p.id === i.pillar_id);
              return (
                <li key={i.id} className={ROW_CLASS_NAME}>
                  <button type="button" className={ROW_BUTTON_CLASS_NAME} onClick={() => onOpen(i.id)}>
                    <div className={ROW_MAIN_CLASS_NAME}>
                      <Text size="xs" tone="muted">{i.scheduled_at ? `${dateText(i.scheduled_at)} · ${timeText(i.scheduled_at)}` : t("noDate")}</Text>
                      <Text weight="semibold">{i.title}</Text>
                      {i.brief ? <Text size="sm" tone="muted" overflow="clamp-2">{i.brief}</Text> : null}
                      <div className={CHIPS_CLASS_NAME}>
                        <StatusBadge status={i.status} />
                        <ChannelBadges channels={i.channels} />
                        <Text as="span" size="xs" tone="muted">{pillar?.name ?? t("noPillar")}</Text>
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </SurfaceCard>
    </>
  );
};
