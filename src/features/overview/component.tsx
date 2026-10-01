"use client";

import { FoundingOffer } from "@/components/promo/FoundingOffer";
import { OnboardingChecklist } from "@/components/promo/OnboardingChecklist";
import type { PromoState } from "@/features/promo/queries";

import Link from "next/link";
import { Badge, Button, EmptyNotice, PrimaryRailLayout, SectionHeader, SurfaceCard, SurfaceListCard, Text, TextAction } from "@starci/grammar/common";
import { TileIcon, type IconName } from "@/ui";
import { AgentAvatar } from "@/components/avatar/PersonAvatar";
import { useT } from "@/i18n/client";
import { overview } from "@/i18n/dict/overview";
import { OwnerGroups } from "@/features/responsibilities/component";
import type { ActivityModel, OwnerGroupModel } from "@/features/responsibilities/format";
import type { Agent } from "@/lib/types";
import type { WorkItemView } from "@/lib/flow-types";
import type { GovernanceWithStatus } from "@/lib/flow-queries";
import { GovernanceBlocks } from "./governance";
import {
  ACTIVITY_HEAD_CLASS_NAME,
  ACTIVITY_ROW_CLASS_NAME,
  ACTIVITY_TEXT_CLASS_NAME,
  AGENT_ROW_CLASS_NAME,
  AGENT_TEXT_CLASS_NAME,
  BANNER_COPY_CLASS_NAME,
  HEADER_ACTIONS_CLASS_NAME,
  KPI_CLASS_NAME,
  KPI_GRID_CLASS_NAME,
  MAIN_CLASS_NAME,
  NEEDS_CLASS_NAME,
  PAGE_CLASS_NAME,
  PAGE_INSET_CLASS_NAME,
  RAIL_CLASS_NAME,
  RAIL_ROW_CLASS_NAME,
} from "./classNames";

/** Real counts for the KPI band. */
export type OverviewCounts = { open: number; waitingApproval: number; dueToday: number; overdue: number; leadsThisWeek: number };

/** Props for {@link OverviewBase}. */
export type OverviewBaseProps = {
  title: string;
  updatedLabel: string;
  verifiedLabel: string;
  groups: ReadonlyArray<OwnerGroupModel>;
  groupTotal: number;
  counts: OverviewCounts;
  governance: GovernanceWithStatus | null;
  waiting: ReadonlyArray<WorkItemView>;
  agents: ReadonlyArray<Pick<Agent, "id" | "name" | "handle" | "status" | "module">>;
  activity: ReadonlyArray<ActivityModel>;
  hasAgents: boolean;
  promo: PromoState;
};

const KIND_ICONS: Record<string, IconName> = {
  "lead.captured": "account",
  "context.summarised": "talents",
  "responsibility.assigned": "review",
  "execution.drafted": "send",
  "execution.approved": "complete",
  "execution.rejected": "close",
  "outcome.recorded": "saved",
  "agent.installed": "agentos",
  "agent.updated": "agentos",
};

type KpiProps = { label: string; value: number; href: string; isAlert?: boolean };

const Kpi = (props: KpiProps) => (
  <Link href={props.href} className={KPI_CLASS_NAME} aria-label={`${props.label}: ${props.value}`}>
    <Text size="xs" tone="muted">{props.label}</Text>
    <Text size="metric-lead" weight="semibold" tone={props.isAlert === true && props.value > 0 ? "accent" : "default"}>
      {String(props.value)}
    </Text>
  </Link>
);

const ROW_LIMIT = 6;

/** Keeps the first few open rows across owners so the dashboard stays a glance, not a wall. */
const trimGroups = (groups: ReadonlyArray<OwnerGroupModel>): ReadonlyArray<OwnerGroupModel> => {
  let left = ROW_LIMIT;
  const kept: Array<OwnerGroupModel> = [];
  for (const group of groups) {
    if (left <= 0) break;
    const rows = group.rows.slice(0, left);
    left -= rows.length;
    kept.push({ ...group, rows });
  }
  return kept;
};

/** P01 Overview: what needs you first, one next action, real counts, open work, agents and recent activity. */
export const OverviewBase = (props: OverviewBaseProps) => {
  const t = useT(overview);
  const hasChatbot = props.agents.some((agent) => agent.module === "chatbot");
  const needsYou = (props.governance?.pendingDecisions ?? 0) > 0;
  return (
    <div className={PAGE_INSET_CLASS_NAME}>
      <div className={PAGE_CLASS_NAME}>
        <SectionHeader
          level={1}
          eyebrow={t("eyebrow")}
          title={props.title}
          description={t("description", { time: props.updatedLabel })}
          action={
            <div className={HEADER_ACTIONS_CLASS_NAME}>
              <Button variant="outline" href="/chat">{t("openOffice")}</Button>
              <Button variant={needsYou ? "outline" : "primary"} href="/leads?new=1">{t("newLead")}</Button>
            </div>
          }
        />

        <GovernanceBlocks governance={props.governance} waiting={props.waiting} />

        <SectionHeader level={2} title={t("ownerBelow")} />
        <SurfaceCard ariaLabel={t("kpiAria")}>
          <div className={KPI_GRID_CLASS_NAME}>
            <Kpi label={t("kpiOpen")} value={props.counts.open} href="/responsibilities?status=open" />
            <Kpi label={t("kpiWaiting")} value={props.counts.waitingApproval} href="/responsibilities?status=waiting_approval" isAlert />
            <Kpi label={t("kpiToday")} value={props.counts.dueToday} href="/responsibilities?due=today" />
            <Kpi label={t("kpiOverdue")} value={props.counts.overdue} href="/responsibilities?due=overdue" isAlert />
            <Kpi label={t("kpiLeads")} value={props.counts.leadsThisWeek} href="/leads" />
          </div>
        </SurfaceCard>

        <PrimaryRailLayout
          railWidth="standard"
          align="start"
          primary={
            <div className={MAIN_CLASS_NAME}>
              <SectionHeader
                level={2}
                title={t("byOwner")}
                action={
                  props.groupTotal > ROW_LIMIT ? (
                    <TextAction href="/responsibilities" appearance="section">{t("viewAllCount", { n: props.groupTotal })}</TextAction>
                  ) : (
                    <Text size="xs" tone="muted">{props.verifiedLabel}</Text>
                  )
                }
              />
              <OwnerGroups
                groups={trimGroups(props.groups)}
                emptyMessage={t("emptyMessage")}
                emptyDescription={props.hasAgents ? t("emptyWithAgents") : t("emptyNoAgents")}
                emptyActionLabel={props.hasAgents ? t("emptyActionLead") : t("emptyActionModules")}
                emptyHref={props.hasAgents ? "/leads?new=1" : "/modules"}
              />
            </div>
          }
          rail={
            <div className={RAIL_CLASS_NAME}>
              <OnboardingChecklist steps={props.promo.onboarding} />

              <SurfaceListCard
                label={t("agents")}
                footer={
                  hasChatbot ? undefined : (
                    <Button variant="secondary" size="sm" href="/modules/new?module=chatbot">{t("buyChatbot")}</Button>
                  )
                }
                empty={<EmptyNotice message={t("agentsEmpty")} description={t("agentsEmptyDesc")} />}
              >
                {props.agents.length === 0
                  ? undefined
                  : props.agents.map((agent) => (
                      <li key={agent.id} className={AGENT_ROW_CLASS_NAME}>
                        <AgentAvatar module={agent.module} label={agent.name} online={agent.status === "active"} />
                        <div className={AGENT_TEXT_CLASS_NAME}>
                          <Text weight="semibold" overflow="truncate">{agent.name}</Text>
                          <div>
                            <Badge tone={agent.status === "active" ? "success" : "neutral"} isDot>{agent.status === "active" ? t("active") : t("paused")}</Badge>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" href={`/modules/${agent.id}/chat`}>{t("chat")}</Button>
                      </li>
                    ))}
              </SurfaceListCard>

              <SurfaceListCard
                label={t("activity")}
                footer={<TextAction href="/responsibilities" appearance="section">{t("viewAll")}</TextAction>}
                empty={<EmptyNotice message={t("activityEmpty")} description={t("activityEmptyDesc")} />}
              >
                {props.activity.length === 0
                  ? undefined
                  : props.activity.map((item) => {
                      const body = (
                        <div className={ACTIVITY_ROW_CLASS_NAME}>
                          <TileIcon props={{ icon: KIND_ICONS[item.kind] ?? "notification" }} />
                          <div className={ACTIVITY_TEXT_CLASS_NAME}>
                            <div className={ACTIVITY_HEAD_CLASS_NAME}>
                              <Text size="sm" weight="semibold" overflow="truncate">{item.actor}</Text>
                              <Text size="xs" tone="muted">{item.timeLabel}</Text>
                            </div>
                            <Text size="sm" overflow="clamp-2">{item.summary}</Text>
                          </div>
                        </div>
                      );
                      return (
                        <li key={item.id} className={RAIL_ROW_CLASS_NAME}>
                          {item.leadId === null ? body : <Link href={`/leads/${item.leadId}`}>{body}</Link>}
                        </li>
                      );
                    })}
              </SurfaceListCard>
            </div>
          }
        />

        <FoundingOffer variant="hero" />
      </div>
    </div>
  );
};
