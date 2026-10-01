"use client";

import { SurfaceListCard } from "@starci/grammar/common";

import { ApprovalCard } from "@/features/approval-card";
import { useT } from "@/i18n/client";
import { lead as leadDict } from "@/i18n/dict/lead";
import type { LeadDetail } from "@/lib/types";

import { EXECUTION_EARLIER_LIST_CLASS_NAME, EXECUTION_PANEL_CLASS_NAME } from "./classNames";
import { DraftCard } from "./DraftCard";

/** Props for the execution panel. */
export type ExecutionPanelProps = { readonly detail: LeadDetail };

/** P04 Human x AI execution: draft with the owning agent, then approve, edit or reject before anything is sent. */
export const ExecutionPanel = (props: ExecutionPanelProps) => {
  const t = useT(leadDict);
  const { lead, responsibilities, executions, agents } = props.detail;
  const current = [...responsibilities]
    .filter((r) => r.status !== "done")
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  const agentName = (agentId: string | null): string | null => agents.find((a) => a.id === agentId)?.name ?? null;
  const nextActionOf = (respId: string): string => responsibilities.find((r) => r.id === respId)?.next_action ?? t("defaultNextAction");
  const pendingList = executions.filter((e) => e.status === "pending_approval");
  const pending = pendingList.find((e) => e.responsibility_id === current?.id) ?? pendingList[0];
  const earlier = executions
    .filter((e) => e !== pending)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  const owner = current?.owner_agent_id ? agents.find((a) => a.id === current.owner_agent_id) : undefined;
  const explanation =
    current === undefined
      ? t("noOpenNext")
      : owner === undefined
        ? t("youOwnThis")
        : t("agentDrafts", { name: owner.name, handle: owner.handle });

  return (
    <div className={EXECUTION_PANEL_CLASS_NAME}>
      {pending !== undefined ? (
        <ApprovalCard
          execution={pending}
          leadName={lead.contact_name}
          channel={lead.channel}
          agentName={agentName(pending.agent_id)}
          nextAction={nextActionOf(pending.responsibility_id)}
        />
      ) : (
        <DraftCard
          responsibilityId={current?.id ?? null}
          explanation={explanation}
          actorName={owner?.name ?? "AI"}
          buttonLabel={t("draftWith", { name: owner?.name ?? "AI" })}
        />
      )}
      {earlier.length === 0 ? null : (
        <SurfaceListCard label={t("earlierApprovals")} fact={t("decidedCount", { count: earlier.length })}>
          <div className={EXECUTION_EARLIER_LIST_CLASS_NAME}>
            {earlier.map((e) => (
              <ApprovalCard
                key={e.id}
                execution={e}
                leadName={lead.contact_name}
                channel={lead.channel}
                agentName={agentName(e.agent_id)}
                nextAction={nextActionOf(e.responsibility_id)}
              />
            ))}
          </div>
        </SurfaceListCard>
      )}
    </div>
  );
};
