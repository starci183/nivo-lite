"use client";

import { AgentAvatar, PersonAvatar } from "@/components/avatar/PersonAvatar";
import { Badge, Heading, SurfaceCard, Text, Timeline, type BadgeTone } from "@starci/grammar/common";
import type { ReactNode } from "react";
import { useT } from "@/i18n/client";
import { lead as leadDict } from "@/i18n/dict/lead";
import type { Responsibility } from "@/lib/types";
import {
  ACTIONS_CLASS_NAME, BODY_CLASS_NAME, DUE_CLASS_NAME, FACT_CLASS_NAME, FACTS_CLASS_NAME, OWNER_CLASS_NAME,
  OWNER_COPY_CLASS_NAME, PANEL_CLASS_NAME, TITLE_ROW_CLASS_NAME, OWNER_BAND_CLASS_NAME, FOCAL_CLASS_NAME,
} from "./classNames";
import { statusLabel, type DueFacts } from "./format";

const STATUS_TONE: Readonly<Record<Responsibility["status"], BadgeTone>> = {
  open: "neutral",
  waiting_approval: "warning",
  done: "success",
};

/** One earlier responsibility, already resolved to text. */
export type PreviousItem = { readonly id: string; readonly title: string; readonly owner: string; readonly status: string };

/** Props of the presentational responsibility panel. */
export type ResponsibilityBaseProps = {
  readonly current: Responsibility | null;
  readonly ownerHandle: string | null;
  readonly due: DueFacts | null;
  readonly previous: ReadonlyArray<PreviousItem>;
  /** Client-owned actions for the current responsibility, or the empty-state action when there is none. */
  readonly actions: ReactNode;
};

/** Pure view: current responsibility card (next action, owner, due, status) plus the earlier responsibilities timeline. */
export const ResponsibilityBase = ({ current, ownerHandle, due, previous, actions }: ResponsibilityBaseProps) => {
  const t = useT(leadDict);
  return (
  <div className={PANEL_CLASS_NAME}>
    <SurfaceCard label={t("nextStepOwner")}>
      {current === null ? (
        actions
      ) : (
        <div className={BODY_CLASS_NAME}>
          <div className={TITLE_ROW_CLASS_NAME}>
            <Text size="sm" tone="muted">{current.title}</Text>
            <Badge tone={STATUS_TONE[current.status]}>{statusLabel(current.status, t)}</Badge>
          </div>
          <div className={FOCAL_CLASS_NAME}>
            <Text size="xs" tone="muted" weight="semibold">{t("nextStep")}</Text>
            <Heading level={2}>{current.next_action}</Heading>
          </div>
          <div className={OWNER_BAND_CLASS_NAME}>
            <div className={OWNER_CLASS_NAME}>
              {current.owner_kind === "agent" ? (
                <AgentAvatar module="chatbot" size="md" label={current.owner_name} />
              ) : (
                <PersonAvatar name={current.owner_name} size="md" />
              )}
              <div className={OWNER_COPY_CLASS_NAME}>
                <Text weight="semibold">
                  {current.owner_kind === "agent" ? `@${ownerHandle ?? current.owner_name}` : current.owner_name}
                </Text>
                <Text size="xs" tone="muted">
                  {`${current.owner_kind === "agent" ? t("aiAgent") : t("human")} · ${t("accountable")}`}
                </Text>
              </div>
            </div>
            <div className={FACT_CLASS_NAME}>
              <Text size="xs" tone="muted">{t("due")}</Text>
              {due === null ? (
                <Text tone="muted">{t("noDue")}</Text>
              ) : (
                <div className={DUE_CLASS_NAME}>
                  <Text weight="semibold">{due.date}</Text>
                  <Text size="sm" tone="muted">{due.relative}</Text>
                  {due.isOverdue && current.status !== "done" ? <Badge tone="danger">{t("overdue")}</Badge> : null}
                </div>
              )}
            </div>
          </div>
          <div className={ACTIONS_CLASS_NAME}>{actions}</div>
        </div>
      )}
    </SurfaceCard>
    {previous.length > 0 ? (
      <SurfaceCard label={t("previousSteps")}>
        <Timeline
          label={t("previousSteps")}
          items={previous.map((item) => ({
            id: item.id,
            title: item.title,
            description: `${item.owner} · ${item.status}`,
          }))}
        />
      </SurfaceCard>
    ) : null}
  </div>
  );
};
