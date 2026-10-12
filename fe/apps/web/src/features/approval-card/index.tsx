"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { canDecideItem, useMember } from "@/features/shell/member-context";
import { useT } from "@/i18n/client";
import { approval } from "@/i18n/dict/approval";
import { decideExecution } from "@/lib/actions";
import type { Execution } from "@/lib/types";

import { ApprovalCardBase } from "./component";

/** Props for the connected approval card. */
export type ApprovalCardProps = {
  readonly execution: Execution;
  readonly leadName: string;
  readonly channel: string;
  readonly agentName: string | null;
  readonly nextAction: string;
  readonly href?: string;
  /** Staff member the draft's work item is assigned to; without it only owner and manager see decision buttons. */
  readonly assignedStaffId?: string | null;
};

/** Approval card for one execution: approve (optionally edited) or reject, then refreshes the page. */
export const ApprovalCard = ({ assignedStaffId, ...props }: ApprovalCardProps) => {
  const member = useMember();
  const canDecide = canDecideItem(member, assignedStaffId);
  const router = useRouter();
  const t = useT(approval);
  const [isPending, startTransition] = useTransition();
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(props.execution.draft);
  const [pendingDecision, setPendingDecision] = useState<"approved" | "rejected" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onDecide = (decision: "approved" | "rejected") => {
    setError(null);
    setPendingDecision(decision);
    startTransition(async () => {
      const trimmed = editText.trim();
      const edited = decision === "approved" && isEditing && trimmed !== props.execution.draft ? trimmed : undefined;
      const result = await decideExecution(props.execution.id, decision, edited);
      if (result.ok) {
        router.refresh();
      } else {
        setError(`${result.error} ${t("stillWaiting")}`);
      }
      setPendingDecision(null);
    });
  };

  const onToggleEdit = () => {
    setEditText(props.execution.draft);
    setIsEditing((value) => !value);
  };

  return (
    <ApprovalCardBase
      {...props}
      canDecide={canDecide}
      isEditing={isEditing}
      editText={editText}
      pendingDecision={isPending ? pendingDecision : null}
      error={error}
      onToggleEdit={onToggleEdit}
      onEditChange={setEditText}
      onDecide={onDecide}
    />
  );
};
