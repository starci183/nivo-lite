"use client";

import { parseDate } from "@internationalized/date";
import { Alert, Button, DateField, EmptyNotice, Form, Input, Select, Textarea } from "@starci/grammar/common";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useT } from "@/i18n/client";
import { lead as leadDict } from "@/i18n/dict/lead";
import { addResponsibility, assignResponsibility, suggestResponsibility } from "@/lib/actions";
import type { Agent, Outcome, Responsibility } from "@/lib/types";
import { ACTIONS_CLASS_NAME, FORM_CLASS_NAME } from "./classNames";
import { dateOnly, dueFromDate } from "./format";

/** Props of the client action area of the responsibility card. */
export type ResponsibilityActionsProps = {
  readonly leadId: string;
  readonly current: Responsibility | null;
  readonly agents: ReadonlyArray<Agent>;
};

type AssignFormProps = {
  readonly mode: "reassign" | "add" | "due";
  readonly leadId: string;
  readonly current: Responsibility | null;
  readonly agents: ReadonlyArray<Agent>;
  readonly onClose: () => void;
};

const currentOwnerId = (current: Responsibility | null): string =>
  current?.owner_kind === "agent" && current.owner_agent_id ? current.owner_agent_id : "human";

/** Inline form for reassigning the current responsibility or adding the next one. */
const AssignForm = ({ mode, leadId, current, agents, onClose }: AssignFormProps) => {
  const router = useRouter();
  const t = useT(leadDict);
  const [isPending, startTransition] = useTransition();
  const isAdd = mode === "add";
  const isDueOnly = mode === "due";
  const [title, setTitle] = useState("");
  const [owner, setOwner] = useState(isAdd ? "human" : currentOwnerId(current));
  const [nextAction, setNextAction] = useState(isAdd ? "" : (current?.next_action ?? ""));
  const [due, setDue] = useState<string | null>(isAdd ? null : dateOnly(current?.due_at ?? null));
  const [error, setError] = useState<string | null>(null);

  const options = [
    { id: "human", label: t("ownerYou") },
    ...agents
      .filter((agent) => agent.status === "active" || agent.id === owner)
      .map((agent) => ({ id: agent.id, label: `${agent.name} (@${agent.handle.replace(/^@/, "")})` })),
  ];

  const onSubmit = () => {
    setError(null);
    startTransition(async () => {
      const dueAt = dueFromDate(due);
      const result: Outcome<Responsibility> = isAdd
        ? await addResponsibility(leadId, { title: title.trim(), owner, next_action: nextAction.trim(), due_at: dueAt })
        : current
          ? await assignResponsibility(current.id, {
              owner,
              next_action: isDueOnly ? current.next_action : nextAction.trim(),
              due_at: dueAt,
            })
          : { ok: false, error: t("noOpenStep") };
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onClose();
      router.refresh();
    });
  };

  return (
    <Form label={isAdd ? t("formAdd") : isDueOnly ? t("formDue") : t("formReassign")} onSubmit={onSubmit} isPending={isPending}>
      <div className={FORM_CLASS_NAME}>
        {isAdd ? (
          <Input id="responsibility-title" name="title" label={t("fieldTitle")} variant="secondary" value={title} onValueChange={setTitle} isRequired />
        ) : null}
        {isDueOnly ? null : (
          <>
            <Select label={t("fieldOwner")} options={options} value={owner} onValueChange={(value) => setOwner(value ?? "human")} />
            <Textarea label={t("fieldNextStep")} rows={3} value={nextAction} onValueChange={setNextAction} isRequired />
          </>
        )}
        <DateField
          label={t("fieldDue")}
          granularity="day"
          value={due ? parseDate(due) : null}
          onValueChange={(value) => setDue(value ? value.toString() : null)}
        />
        {error === null ? null : <Alert title={t("saveFailed")} description={error} tone="negative" />}
        <div className={ACTIONS_CLASS_NAME}>
          <Button variant="ghost" onPress={onClose} isDisabled={isPending}>{t("cancel")}</Button>
          <Button variant="secondary" type="submit" isPending={isPending}>{isAdd ? t("addStep") : isDueOnly ? t("saveDue") : t("saveChanges")}</Button>
        </div>
      </div>
    </Form>
  );
};

/** Empty state: no owner yet, one primary action asks the AI to propose one. */
const ProposeOwner = ({ leadId }: { readonly leadId: string }) => {
  const router = useRouter();
  const t = useT(leadDict);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onPropose = () => {
    setError(null);
    startTransition(async () => {
      const result = await suggestResponsibility(leadId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <>
      <EmptyNotice
        message={t("noOwner")}
        description={t("noOwnerHint")}
        actionLabel={t("proposeOwner")}
        actionVariant="primary"
        isActionPending={isPending}
        onAction={onPropose}
      />
      {error === null ? null : <Alert title={t("proposeFailed")} description={error} tone="negative" />}
    </>
  );
};

/** Client actions: propose (none), add next (done) or reassign / change due date / ask in Office (open, waiting approval). */
export const ResponsibilityActions = ({ leadId, current, agents }: ResponsibilityActionsProps) => {
  const t = useT(leadDict);
  const [mode, setMode] = useState<"reassign" | "add" | "due" | null>(null);

  if (current === null) return <ProposeOwner leadId={leadId} />;
  if (mode !== null) {
    return <AssignForm mode={mode} leadId={leadId} current={current} agents={agents} onClose={() => setMode(null)} />;
  }
  if (current.status === "done") {
    return <Button variant="outline" onPress={() => setMode("add")}>{t("formAdd")}</Button>;
  }
  return (
    <>
      <Button variant="outline" onPress={() => setMode("reassign")}>{t("reassign")}</Button>
      <Button variant="outline" onPress={() => setMode("due")}>{t("changeDue")}</Button>
      {current.owner_kind === "agent" ? <Button variant="ghost" href="/chat">{t("askInOffice")}</Button> : null}
    </>
  );
};
