"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert, Button, CheckboxGroup, SurfaceCard, Text } from "@starci/grammar/common";
import { StatusBadge } from "@/features/connections/StatusBadge";
import { useT } from "@/i18n/client";
import { connections as dict } from "@/i18n/dict/connections";
import { setAgentConnections } from "@/lib/connection-actions";
import { STACK_CLASS_NAME } from "./classNames";

export type ConnectionOption = { readonly id: string; readonly label: string; readonly status: "connected" | "error" | "disconnected" };

type AgentConnectionsCardProps = {
  readonly agentId: string;
  readonly options: ReadonlyArray<ConnectionOption>;
  readonly selected: ReadonlyArray<string>;
  readonly canEdit: boolean;
};

/** "Connections this agent uses": tick which of the workspace's connections this agent works through. Staff see it read-only. */
export const AgentConnectionsCard = ({ agentId, options, selected, canEdit }: AgentConnectionsCardProps) => {
  const t = useT(dict);
  const router = useRouter();
  const [value, setValue] = useState<ReadonlyArray<string>>(selected);
  const [note, setNote] = useState<{ ok: boolean; text: string } | undefined>();
  const [pending, startTransition] = useTransition();
  const dirty = value.length !== selected.length || value.some((id) => !selected.includes(id));

  const save = () => {
    setNote(undefined);
    startTransition(async () => {
      const r = await setAgentConnections(agentId, value);
      setNote(r.ok ? { ok: true, text: t("agentCardSaved") } : { ok: false, text: r.error });
      if (r.ok) router.refresh();
    });
  };

  return (
    <SurfaceCard label={t("agentCardTitle")} headingLevel={2}>
      <div className={STACK_CLASS_NAME}>
        <Text size="sm" tone="muted">{t("agentCardHint")}</Text>
        {options.length === 0 ? (
          <Text size="sm">{t("agentCardNone")}</Text>
        ) : (
          <CheckboxGroup
            label={t("agentCardTitle")}
            isLabelHidden
            options={options.map((o) => ({ value: o.id, label: o.label, description: <StatusBadge status={o.status} />, isDisabled: !canEdit || pending || (o.status === "disconnected" && !value.includes(o.id)) }))}
            value={[...value]}
            onValueChange={(v) => setValue(v)}
          />
        )}
        {canEdit ? (
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="secondary" isPending={pending} isDisabled={!dirty} onPress={save}>{t("agentCardSave")}</Button>
            <Link href="/connections" className="text-sm underline">{t("agentCardManage")}</Link>
          </div>
        ) : (
          <Text size="xs" tone="muted">{t("agentCardReadOnly")}</Text>
        )}
        {note ? <Alert title={note.text} tone={note.ok ? "affirmative" : "negative"} /> : null}
      </div>
    </SurfaceCard>
  );
};
