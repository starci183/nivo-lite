"use client";

import { useState } from "react";
import { SurfaceAccordionCard, Text } from "@starci/grammar/common";
import { AgentAvatar, PersonAvatar } from "@/components/avatar/PersonAvatar";
import { useT } from "@/i18n/client";
import { lead as leadDict } from "@/i18n/dict/lead";
import { BUBBLE, BUBBLE_HEAD, MESSAGE_ROW, THREAD } from "./classNames";
import type { EventView } from "./format";

type HistoryListProps = { events: ReadonlyArray<EventView> };

const isAgentActor = (actor: string): boolean => /(ai|agent)|^@/i.test(actor);

/** Chat-style thread of events, oldest first so the latest sits at the bottom; entries with evidence expand to show it. */
export const HistoryList = (props: HistoryListProps) => {
  const t = useT(leadDict);
  const [open, setOpen] = useState<Readonly<Record<string, boolean>>>({});
  const ordered = [...props.events].reverse();

  return (
    <ol className={THREAD} aria-label={t("historyLabel")}>
      {ordered.map((event) => (
        <li key={event.id} className={MESSAGE_ROW}>
          {isAgentActor(event.actor) ? <AgentAvatar module="chatbot" size="sm" label={event.actor} /> : <PersonAvatar name={event.actor} size="sm" />}
          <div className={BUBBLE}>
            <div className={BUBBLE_HEAD}>
              <Text as="span" size="sm" weight="semibold">{event.actor}</Text>
              <Text as="span" size="xs" tone="muted"><time dateTime={event.dateTime}>{event.timeLabel}</time></Text>
            </div>
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
        </li>
      ))}
    </ol>
  );
};
