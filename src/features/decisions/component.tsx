"use client";

import { Badge, EmptyNotice, PageContainer, SectionHeader, SurfaceCard, Tabs, Text, TextAction } from "@starci/grammar/common";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useT } from "@/i18n/client";
import { intlLocale } from "@/i18n/core";
import { decisions as decisionsDict } from "@/i18n/dict/decisions";
import { governance } from "@/i18n/dict/governance";
import type { DecisionRow, Department } from "@/lib/flow-types";
import { MODULE_KEYS } from "@/lib/module-registry";
import { CHIPS_CLASS_NAME, FILTERS_CLASS_NAME, LIST_CLASS_NAME, PAGE_CLASS_NAME, ROW_CLASS_NAME, ROW_FOOT_CLASS_NAME, ROW_HEAD_CLASS_NAME, TABS_CLASS_NAME } from "./classNames";
import { formatDateTime, outcomeTone, splitBasis } from "./format";

export type DecisionKind = "policy" | "human" | "rejected";

/** Props for {@link DecisionsView}. */
export type DecisionsViewProps = {
  readonly rows: ReadonlyArray<DecisionRow>;
  readonly kind: DecisionKind | null;
  readonly dept: Department | null;
  readonly limit: number;
  /** True when the query failed (for example the flow tables are not migrated yet). */
  readonly hasFailed: boolean;
};

const ALL = "all";
const KINDS: ReadonlyArray<DecisionKind> = ["policy", "human", "rejected"];
const DEPTS: ReadonlyArray<Department> = MODULE_KEYS;

const KIND_LABEL = { policy: "kindPolicy", human: "kindHuman", rejected: "kindRejected" } as const;

const isKind = (key: string): key is DecisionKind => (KINDS as ReadonlyArray<string>).includes(key);
const isDept = (key: string): key is Department => (DEPTS as ReadonlyArray<string>).includes(key);

const hrefFor = (kind: DecisionKind | null, dept: Department | null) => {
  const qs = new URLSearchParams();
  if (kind) qs.set("kind", kind);
  if (dept) qs.set("dept", dept);
  const text = qs.toString();
  return text ? `/decisions?${text}` : "/decisions";
};

/** /decisions body: filters plus a list (not a table, so it reads on a phone) of who decided what, when and with what result. */
export const DecisionsView = ({ rows, kind, dept, limit, hasFailed }: DecisionsViewProps) => {
  const t = useT(decisionsDict);
  const g = useT(governance);
  const locale = useLocale();
  const router = useRouter();
  const isFiltered = kind !== null || dept !== null;

  return (
    <PageContainer measure="product">
      <div className={PAGE_CLASS_NAME}>
        <SectionHeader level={1} eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />
        <div className={FILTERS_CLASS_NAME}>
          <div className={TABS_CLASS_NAME}>
            <Tabs
              label={t("kindLabel")}
              selectedKey={kind ?? ALL}
              inset="none"
              labelVisibility="always"
              items={[{ id: ALL, label: t("kindAll") }, ...KINDS.map((k) => ({ id: k, label: t(KIND_LABEL[k]) }))]}
              onSelect={(key) => router.push(hrefFor(isKind(key) ? key : null, dept))}
            />
          </div>
          <div className={TABS_CLASS_NAME}>
            <Tabs
              label={t("deptLabel")}
              selectedKey={dept ?? ALL}
              inset="none"
              labelVisibility="always"
              items={[{ id: ALL, label: t("deptAll") }, ...DEPTS.map((d) => ({ id: d, label: g(`dept_${d}`) }))]}
              onSelect={(key) => router.push(hrefFor(kind, isDept(key) ? key : null))}
            />
          </div>
        </div>

        {hasFailed ? (
          <SurfaceCard ariaLabel={t("loadFailedTitle")}>
            <EmptyNotice message={t("loadFailedTitle")} description={t("loadFailedBody")} />
          </SurfaceCard>
        ) : rows.length === 0 ? (
          <SurfaceCard ariaLabel={t("listAria")}>
            {isFiltered ? (
              <EmptyNotice message={t("noMatchTitle")} description={t("noMatchBody")} actionLabel={t("clearFilters")} actionVariant="secondary" onAction={() => router.push("/decisions")} />
            ) : (
              <EmptyNotice message={t("emptyTitle")} description={t("emptyBody")} />
            )}
          </SurfaceCard>
        ) : (
          <>
            <Text size="xs" tone="muted">{rows.length >= limit ? t("countCapped", { n: rows.length }) : t("count", { n: rows.length })}</Text>
            <SurfaceCard ariaLabel={t("listAria")}>
              <ul className={LIST_CLASS_NAME}>
                {rows.map((row) => (
                  <li key={row.id} className={ROW_CLASS_NAME}>
                    <div className={ROW_HEAD_CLASS_NAME}>
                      <div className={CHIPS_CLASS_NAME}>
                        <Text weight="semibold">{g(`action_${row.action}`)}</Text>
                        <Badge tone={outcomeTone(row.outcome)}>{g(`outcome_${row.outcome}`)}</Badge>
                      </div>
                      <Text size="xs" tone="muted">{formatDateTime(row.created_at, intlLocale(locale))}</Text>
                    </div>
                    <div className={CHIPS_CLASS_NAME}>
                      <Badge tone="neutral">{g(`dept_${row.department}`)}</Badge>
                      <Text size="sm" tone="muted">{row.decider_kind === "policy" ? g("decider_policy") : row.decided_by}</Text>
                    </div>
                    {row.reason && row.reason !== "routine" ? <Text size="sm">{`${g(`reason_${row.reason}`)} — ${g(`reasonHint_${row.reason}`)}`}</Text> : null}
                    {(() => {
                      const { basis, rest } = splitBasis(row.note);
                      return (
                        <>
                          {basis ? <Text size="sm" weight="medium">{t("basis", { basis })}</Text> : null}
                          {rest ? <Text size="sm" tone="muted">{t("note", { note: rest })}</Text> : null}
                        </>
                      );
                    })()}
                    <div className={ROW_FOOT_CLASS_NAME}>
                      {row.lead_id ? (
                        <Link href={`/leads/${row.lead_id}`}>
                          <Text as="span" size="sm" weight="medium">{`${row.leadName ?? t("openLead")} →`}</Text>
                        </Link>
                      ) : (
                        <Text size="xs" tone="muted">{t("noLead")}</Text>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </SurfaceCard>
          </>
        )}
        {isFiltered && !hasFailed && rows.length > 0 ? <TextAction onPress={() => router.push("/decisions")}>{t("clearFilters")}</TextAction> : null}
      </div>
    </PageContainer>
  );
};
