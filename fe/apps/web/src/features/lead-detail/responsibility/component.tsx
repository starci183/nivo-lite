"use client";

import { AgentAvatar } from "@/components/blocks/AgentAvatar"
import { PersonAvatar } from "@/components/leaves/PersonAvatar"
import { Avatar, Badge, DescriptionList, Region, SectionHeader, SurfaceCard, Text, Timeline, type BadgeTone } from "@starci/grammar/common";
import type { ReactNode } from "react";
import { useT } from "@/i18n/client";
import { lead as leadDict } from "@/i18n/dict/lead";
import type { Responsibility } from "@/lib/types";
import {
  ACTIONS_CLASS_NAME, BODY_CLASS_NAME, DUE_CLASS_NAME, FOCAL_CLASS_NAME, OWNER_CLASS_NAME, OWNER_COPY_CLASS_NAME,
  OWNER_ROW_CLASS_NAME, PANEL_CLASS_NAME, PREVIOUS_CLASS_NAME, TITLE_ROW_CLASS_NAME,
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
  readonly current?: Responsibility | null;
  readonly ownerHandle?: string | null;
  readonly due?: DueFacts | null;
  readonly previous?: ReadonlyArray<PreviousItem>;
  /** Client-owned actions for the current responsibility, or the empty-state action when there is none. */
  readonly actions?: ReactNode;
  /** STATE-8: the card keeps its labels, the next step, the owner and the due date are skeletons. */
  readonly isLoading?: boolean;
};

/** Pure view: current responsibility card (next action, owner, due, status) plus the earlier responsibilities timeline. */
export const ResponsibilityBase = ({ current = null, ownerHandle = null, due = null, previous = [], actions = null, isLoading = false }: ResponsibilityBaseProps) => {
  const t = useT(leadDict);
  if (isLoading) {
    return (
      <div className={PANEL_CLASS_NAME}>
        <SurfaceCard label={t("nextStepOwner")} headingLevel={2}>
          <div className={BODY_CLASS_NAME}>
            <div className={TITLE_ROW_CLASS_NAME}>
              <Text size="sm" tone="muted" isSkeleton>{t("nextStep")}</Text>
            </div>
            <div className={FOCAL_CLASS_NAME}>
              <Text size="xs" tone="muted" weight="semibold">{t("nextStep")}</Text>
              <Text size="md" weight="semibold" isSkeleton>{t("nextStep")}</Text>
            </div>
            <SurfaceCard depth="nested" ariaLabel={t("accountable")}>
              <div className={OWNER_ROW_CLASS_NAME}>
                <div className={OWNER_CLASS_NAME}>
                  <Avatar name="" size="md" isSkeleton />
                  <div className={OWNER_COPY_CLASS_NAME}>
                    <Text weight="semibold" isSkeleton>{t("accountable")}</Text>
                    <Text size="xs" tone="muted">{t("accountable")}</Text>
                  </div>
                </div>
                <DescriptionList layout="stacked" isLoading items={[{ id: "due", term: t("due"), description: "" }]} />
              </div>
            </SurfaceCard>
          </div>
        </SurfaceCard>
      </div>
    );
  }
  return (
    <div className={PANEL_CLASS_NAME}>
      <SurfaceCard label={t("nextStepOwner")} headingLevel={2}>
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
              <Text size="md" weight="semibold">{current.next_action}</Text>
            </div>
            <SurfaceCard depth="nested" ariaLabel={t("accountable")}>
              <div className={OWNER_ROW_CLASS_NAME}>
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
                <DescriptionList
                  layout="stacked"
                  items={[
                    {
                      id: "due",
                      term: t("due"),
                      description:
                        due === null ? (
                          <Text tone="muted">{t("noDue")}</Text>
                        ) : (
                          <span className={DUE_CLASS_NAME}>
                            <Text as="span" weight="semibold">{due.date}</Text>
                            <Text as="span" size="sm" tone="muted">{due.relative}</Text>
                            {due.isOverdue && current.status !== "done" ? <Badge tone="danger">{t("overdue")}</Badge> : null}
                          </span>
                        ),
                    },
                  ]}
                />
              </div>
            </SurfaceCard>
            <div className={ACTIONS_CLASS_NAME}>{actions}</div>
          </div>
        )}
      </SurfaceCard>
      {previous.length > 0 ? (
        <Region labelledBy="previous-steps-title" className={PREVIOUS_CLASS_NAME}>
          <SectionHeader id="previous-steps-title" level={2} title={t("previousSteps")} />
          <Timeline
            label={t("previousSteps")}
            items={previous.map((item) => ({
              id: item.id,
              title: item.title,
              description: `${item.owner} · ${item.status}`,
            }))}
          />
        </Region>
      ) : null}
    </div>
  );
};
