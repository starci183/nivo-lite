"use client";

import { useState } from "react";
import { Icon, SurfaceAccordionCard, Text, Timeline } from "@starci/grammar/common";
import { nivoIconSource } from "@/ui";
import { useT } from "@/i18n/client";
import { lead as leadDict } from "@/i18n/dict/lead";
import { ENTRY_STACK } from "./classNames";
import { kindIcon, type EventView } from "./format";

type HistoryListProps = { events: ReadonlyArray<EventView> };

/** Append-only audit trail as a Grammar Timeline, oldest first so the latest sits at the bottom; entries with evidence expand to show it. */
export const HistoryList = (props: HistoryListProps) => {
  const t = useT(leadDict);
  const [open, setOpen] = useState<Readonly<Record<string, boolean>>>({});
  const ordered = [...props.events].reverse();

  return (
    <Timeline
      label={t("historyLabel")}
      items={ordered.map((event) => ({
        id: event.id,
        title: event.actor,
        dateTime: event.dateTime,
        timeLabel: event.timeLabel,
        marker: <Icon source={nivoIconSource(kindIcon(event.kind), "chip")} usage="chip" />,
        description: (
          <div className={ENTRY_STACK}>
            <Text as="p" size="xs" tone="muted" weight="medium">{event.label}</Text>
            <Text as="p" size="sm">{event.summary}</Text>
            {event.evidence ? (
              <SurfaceAccordionCard
                depth="nested"
                isOpen={open[event.id] ?? false}
                onOpenChange={(isOpen) => setOpen((prev) => ({ ...prev, [event.id]: isOpen }))}
                summaryRender={t("evidence")}
                bodyRender={event.evidence}
                renderSummary={(summary) => <Text size="sm" weight="medium">{summary}</Text>}
                renderBody={(body) => <Text as="p" size="sm">{body}</Text>}
              />
            ) : null}
          </div>
        ),
      }))}
    />
  );
};
