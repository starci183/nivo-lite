"use client";

import { useState, useTransition } from "react";
import { Alert, Badge, Button, EmptyNotice, SectionHeader, Text } from "@starci/grammar/common";
import { useT } from "@/i18n/client";
import { shifts as dict } from "@/i18n/dict/shifts";
import type { BenchData, WorkItemLite } from "@/lib/module-shifts-view";
import { decideAvailabilityAction, decideWorkAction } from "./actions";
import { BLOCK_CLASS_NAME, LIST_CLASS_NAME, LIST_ITEM_CLASS_NAME, PANEL_CLASS_NAME, ROW_CLASS_NAME } from "./classNames";
import { DAY_LONG, dm } from "./format";

type Props = { readonly data: BenchData; readonly onReload: () => Promise<void> };

const statusBadge = (status: string, item: WorkItemLite | null, t: (k: "stPending" | "stApproved" | "stDeclined" | "stAuto" | "stWaiting") => string) => {
  if (status === "approved") return <Badge tone="success">{item?.decidedPath === "auto" ? t("stAuto") : t("stApproved")}</Badge>;
  if (status === "declined") return <Badge tone="neutral">{t("stDeclined")}</Badge>;
  return <Badge tone="warning">{item?.status === "waiting_decision" ? t("stWaiting") : t("stPending")}</Badge>;
};

/** Yêu cầu: leave, swap / open-shift requests and availability changes, with approve / decline. Swaps inside the rules were already approved by the gate. */
export const RequestsPanel = ({ data, onReload }: Props) => {
  const t = useT(dict);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const name = (id: string | null) => (id ? data.setup.staff.find((p) => p.id === id)?.name ?? "—" : "—");
  const { leaves, swaps, availability } = data.requests;
  const openLeaves = leaves.filter((l) => l.status === "pending");
  const openSwaps = swaps.filter((s) => s.status === "pending");
  const openAvail = availability.filter((a) => a.status === "pending");
  const recent = [...leaves.filter((l) => l.status !== "pending").map((l) => ({ at: l.createdAt, key: l.id, node: `${name(l.staffId)} · ${t("kindLeave")} ${dm(l.from)}${l.to !== l.from ? `–${dm(l.to)}` : ""}`, status: l.status, item: l.item })),
    ...swaps.filter((s) => s.status !== "pending").map((s) => ({ at: s.createdAt, key: s.id, node: `${name(s.toStaffId)} · ${s.kind === "claim" ? t("kindClaim") : t("kindSwap")} ${s.shiftLine}`, status: s.status, item: s.item }))]
    .sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8);

  const decideItem = (id: string, decision: "approved" | "rejected") => start(async () => {
    setError(null);
    const r = await decideWorkAction(id, decision);
    if (!r.ok) setError(r.error);
    await onReload();
  });
  const decideAvail = (id: string, d: "approved" | "declined") => start(async () => {
    setError(null);
    const r = await decideAvailabilityAction(id, d);
    if (!r.ok) setError(r.error);
    await onReload();
  });
  const buttons = (item: WorkItemLite | null) => item?.status === "waiting_decision" ? (
    <div className={ROW_CLASS_NAME}>
      <Button size="sm" variant="primary" isDisabled={pending} onPress={() => decideItem(item.id, "approved")}>{t("approve")}</Button>
      <Button size="sm" variant="outline" isDisabled={pending} onPress={() => decideItem(item.id, "rejected")}>{t("decline")}</Button>
    </div>
  ) : null;

  const none = !openLeaves.length && !openSwaps.length && !openAvail.length;
  return (
    <div className={PANEL_CLASS_NAME}>
      {error ? <Alert tone="negative" title={t("errTitle")} description={error} /> : null}
      {none ? <EmptyNotice message={t("reqNoneTitle")} description={t("reqNoneBody")} /> : null}

      {openLeaves.length ? (
        <section className={BLOCK_CLASS_NAME}>
          <SectionHeader level={2} title={t("reqLeave")} description={t("reqLeaveHint")} />
          <div className={LIST_CLASS_NAME}>
            {openLeaves.map((l) => (
              <div key={l.id} className={LIST_ITEM_CLASS_NAME}>
                <div className="min-w-0">
                  <Text size="sm" weight="semibold">{`${name(l.staffId)}: ${DAY_LONG[(new Date(`${l.from}T00:00:00Z`).getUTCDay() + 6) % 7]} ${dm(l.from)}${l.to !== l.from ? ` – ${dm(l.to)}` : ""}`}</Text>
                  {l.reason ? <Text size="xs" tone="muted">{l.reason}</Text> : null}
                  {l.item?.summary ? <Text size="xs" tone="muted">{l.item.summary}</Text> : null}
                </div>
                <div className={ROW_CLASS_NAME}>{statusBadge(l.status, l.item, t)}{buttons(l.item)}</div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {openSwaps.length ? (
        <section className={BLOCK_CLASS_NAME}>
          <SectionHeader level={2} title={t("reqSwap")} description={t("reqSwapHint")} />
          <div className={LIST_CLASS_NAME}>
            {openSwaps.map((s) => (
              <div key={s.id} className={LIST_ITEM_CLASS_NAME}>
                <div className="min-w-0">
                  <Text size="sm" weight="semibold">{s.kind === "claim" ? t("claimLine", { name: name(s.toStaffId), shift: s.shiftLine }) : t("swapLine", { from: name(s.fromStaffId), to: name(s.toStaffId), shift: s.shiftLine })}</Text>
                  {s.checks.length ? <Text size="xs" tone="muted">{`${t("outsideRules")}: ${s.checks.join(" ")}`}</Text> : null}
                  {s.reason ? <Text size="xs" tone="muted">{s.reason}</Text> : null}
                </div>
                <div className={ROW_CLASS_NAME}>{statusBadge(s.status, s.item, t)}{buttons(s.item)}</div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {openAvail.length ? (
        <section className={BLOCK_CLASS_NAME}>
          <SectionHeader level={2} title={t("reqAvail")} description={t("reqAvailHint")} />
          <div className={LIST_CLASS_NAME}>
            {openAvail.map((a) => (
              <div key={a.id} className={LIST_ITEM_CLASS_NAME}>
                <div className="min-w-0">
                  <Text size="sm" weight="semibold">{`${name(a.staffId)}: ${a.available ? t("canWork") : t("cannotWork")} ${a.date ? dm(a.date) : DAY_LONG[a.weekday ?? 0]} ${a.start}–${a.end}`}</Text>
                  {a.note ? <Text size="xs" tone="muted">{a.note}</Text> : null}
                </div>
                <div className={ROW_CLASS_NAME}>
                  <Button size="sm" variant="primary" isDisabled={pending} onPress={() => decideAvail(a.id, "approved")}>{t("approve")}</Button>
                  <Button size="sm" variant="outline" isDisabled={pending} onPress={() => decideAvail(a.id, "declined")}>{t("decline")}</Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {recent.length ? (
        <section className={BLOCK_CLASS_NAME}>
          <SectionHeader level={2} title={t("reqRecent")} />
          <div className={LIST_CLASS_NAME}>
            {recent.map((r) => (
              <div key={r.key} className={LIST_ITEM_CLASS_NAME}><Text size="sm">{r.node}</Text>{statusBadge(r.status, r.item, t)}</div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
};
