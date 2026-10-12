"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Alert, Badge, Button, EmptyNotice, ListRow, SurfaceListCard, Text, TextAction, type BadgeTone } from "@starci/grammar/common";
import { useLocale, useT } from "@/i18n/client";
import { agentDashboard } from "@/i18n/dict/agentDashboard";
import type { ConnectionItem, DashboardItem, DoneData, KnowledgeData, Region, WaitingData } from "@/lib/agent-dashboard-shared";
import type { ModuleKey } from "@/lib/modules-shared";
import { FOOT_CLASS_NAME, LABEL_END_CLASS_NAME } from "./classNames";
import { formatWhen } from "./format";

type RegionProps<T> = { readonly region: Region<T> | undefined; readonly isLoading: boolean };

/** A region that could not be read fails in place: one negative Alert with a retry, the rest of the page stays (STATE-8). */
const RegionFailed = ({ label }: { readonly label: string }) => {
  const t = useT(agentDashboard);
  const router = useRouter();
  return <Alert tone="negative" title={t("regionFailed")} description={`${label}. ${t("regionFailedText")}`} action={{ label: t("retry"), onAction: () => router.refresh() }} />;
};

const rowDescription = (item: DashboardItem, when: string): string => [item.description, when].filter(Boolean).join(" · ");

/** "Chờ bạn": the decisions of this module that wait for a person, each linking to the decision. */
export const WaitingRegion = ({ region, isLoading }: RegionProps<WaitingData>) => {
  const t = useT(agentDashboard);
  const locale = useLocale();
  const label = t("waitingTitle");
  if (isLoading || !region) return <SurfaceListCard label={label} isLoading />;
  if (!region.ok) return <RegionFailed label={label} />;
  const { total, items } = region.data;
  return (
    <SurfaceListCard
      label={label}
      labelEnd={total > 0 ? <Badge tone="warning" isDot>{String(total)}</Badge> : undefined}
      empty={<EmptyNotice message={t("waitingEmpty")} description={t("waitingEmptyBody")} />}
      footer={total > items.length ? <Text size="sm" tone="muted">{t("waitingMore", { n: total - items.length })}</Text> : undefined}
    >
      {items.map((item) => (
        <ListRow
          key={item.id}
          title={item.title}
          description={rowDescription(item, formatWhen(item.at, locale))}
          actions={<Button size="sm" variant="secondary" href={item.href}>{t("waitingOpen")}</Button>}
        />
      ))}
    </SurfaceListCard>
  );
};

/** "Đã tự làm 7 ngày": how much the agent finished within the owner's rules, and the last few items. */
export const DoneRegion = ({ region, isLoading, module }: RegionProps<DoneData> & { readonly module: ModuleKey }) => {
  const t = useT(agentDashboard);
  const locale = useLocale();
  const label = t("doneTitle");
  if (isLoading || !region) return <SurfaceListCard label={label} isLoading />;
  if (!region.ok) return <RegionFailed label={label} />;
  const { count, items } = region.data;
  return (
    <SurfaceListCard
      label={label}
      labelEnd={
        <div className={LABEL_END_CLASS_NAME}>
          <Badge tone="success" isDot>{t("doneCount", { n: count })}</Badge>
          <TextAction size="sm" href={`/decisions?kind=policy&dept=${module}`}>{t("doneLog")}</TextAction>
        </div>
      }
      empty={<EmptyNotice message={t("doneEmpty")} description={t("doneEmptyBody")} />}
    >
      {items.map((item) => (
        <ListRow
          key={item.id}
          title={<TextAction appearance="plain" href={item.href}>{item.title}</TextAction>}
          description={rowDescription(item, formatWhen(item.at, locale))}
        />
      ))}
    </SurfaceListCard>
  );
};

const STATUS_TONE: Record<ConnectionItem["status"], BadgeTone> = { connected: "success", error: "danger", pending: "neutral" };

/** "Kết nối": the connections bound to this agent (agent_connections), their status and what the agent may do through each. */
export const ConnectionsRegion = ({ region, isLoading }: RegionProps<ReadonlyArray<ConnectionItem>>) => {
  const t = useT(agentDashboard);
  const label = t("connTitle");
  if (isLoading || !region) return <SurfaceListCard label={label} isLoading />;
  if (!region.ok) return <RegionFailed label={label} />;
  return (
    <SurfaceListCard
      label={label}
      labelEnd={<TextAction size="sm" href="/connections">{t("connManage")}</TextAction>}
      empty={<EmptyNotice message={t("connEmpty")} description={t("connEmptyBody")} />}
    >
      {region.data.map((c) => (
        <ListRow
          key={c.id}
          title={c.name}
          description={`${c.providerLabel} · ${t(`connPurpose_${c.purpose}`)}`}
          badges={
            <>
              <Badge tone={STATUS_TONE[c.status]} isDot>{t(`connStatus_${c.status}`)}</Badge>
              <Badge tone="neutral">{t(`connAccess_${c.access}`)}</Badge>
            </>
          }
        />
      ))}
    </SurfaceListCard>
  );
};

/** "Tri thức": what the agent can read (its lens, public and internal) and, when the data exists, the questions it could not answer. */
export const KnowledgeRegion = ({ region, isLoading, gaps: gapsSlot }: RegionProps<KnowledgeData> & { readonly gaps?: ReactNode }) => {
  const t = useT(agentDashboard);
  const locale = useLocale();
  const label = t("knowTitle");
  if (isLoading || !region) return <SurfaceListCard label={label} isLoading />;
  if (!region.ok) return <RegionFailed label={label} />;
  const k = region.data;
  const isInternal = k.audience === "internal";
  const gaps = k.gaps;
  return (
    <>
      <SurfaceListCard
        label={label}
        labelEnd={<TextAction size="sm" href="/knowledge">{t("knowOpen")}</TextAction>}
        footer={<Text size="sm" tone="muted">{isInternal ? t("knowAudienceInternal") : t("knowAudienceCustomer")}</Text>}
      >
        <ListRow title={t("knowPublic")} description={t("knowCounts", { docs: k.documents.public, facts: k.facts.public })} />
        <ListRow
          title={t("knowInternal")}
          description={
            isInternal
              ? [t("knowCounts", { docs: k.documents.internal, facts: k.facts.internal }), k.facts.restricted > 0 ? t("knowRestricted", { n: k.facts.restricted }) : ""].filter(Boolean).join(" · ")
              : t("knowInternalOff")
          }
        />
      </SurfaceListCard>
      {gapsSlot !== undefined ? gapsSlot : gaps ? (
        <SurfaceListCard
          label={t("gapsTitle")}
          labelEnd={
            gaps.openCount > 0 ? (
              <div className={LABEL_END_CLASS_NAME}>
                <Badge tone="warning" isDot>{String(gaps.openCount)}</Badge>
                <TextAction size="sm" href="/knowledge">{t("gapsOpen")}</TextAction>
              </div>
            ) : undefined
          }
          empty={<EmptyNotice message={t("gapsEmpty")} description={t("gapsEmptyBody")} />}
        >
          {gaps.items.map((g) => (
            <ListRow
              key={g.id}
              title={g.question}
              description={formatWhen(g.lastSeenAt, locale)}
              badges={<Badge tone="warning">{t("gapAsked", { n: g.count })}</Badge>}
            />
          ))}
        </SurfaceListCard>
      ) : null}
    </>
  );
};
