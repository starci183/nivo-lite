"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Select, SurfaceCard, Text, TextAction } from "@starci/grammar/common";
import { StatusBadge } from "@/features/connections/StatusBadge";
import { useT } from "@/i18n/client";
import { connections as dict } from "@/i18n/dict/connections";
import { ACCESS_LEVELS, isAccess, type Access } from "@/lib/connection-access";
import { setGrant } from "@/lib/connection-actions";
import { ACTIONS_CLASS_NAME, STACK_CLASS_NAME } from "./classNames";

export type ConnectionOption = {
  readonly id: string;
  readonly label: string;
  readonly status: "pending" | "connected" | "error" | "disconnected";
  /** This agent's access through the connection (null: none). */
  readonly access?: Access | null;
};

type AgentConnectionsCardProps = {
  readonly agentId: string | null;
  readonly options: ReadonlyArray<ConnectionOption>;
  readonly selected: ReadonlyArray<string>;
  /** The workspace owner only; everyone else sees the same levels read-only. */
  readonly canEdit: boolean;
};

const NONE = "none";

/**
 * "Connections this agent uses": every connection this agent's module can work through, each with its access level (No access /
 * Read only / Ask first / Act within the rules). The same grant the connection's own picker on the Connections page changes; a
 * pick is saved at once.
 */
export const AgentConnectionsCard = ({ agentId, options, canEdit }: AgentConnectionsCardProps) => {
  const t = useT(dict);
  const router = useRouter();
  const [local, setLocal] = useState<Readonly<Record<string, Access | null>>>({});
  const [note, setNote] = useState<{ ok: boolean; text: string } | undefined>();
  const [pending, startTransition] = useTransition();
  const accessOf = (o: ConnectionOption): Access | null => (o.id in local ? (local[o.id] ?? null) : (o.access ?? null));
  const levelOptions = [NONE, ...ACCESS_LEVELS].map((v) => ({ id: v, label: v === NONE ? t("accessNone") : t(`access_${v as Access}`) }));

  const pick = (o: ConnectionOption, value: string | null) => {
    if (!agentId || value === null) return;
    const next: Access | null = isAccess(value) ? value : null;
    const before = accessOf(o);
    if (next === before) return;
    setNote(undefined);
    setLocal((p) => ({ ...p, [o.id]: next }));
    startTransition(async () => {
      const r = await setGrant(o.id, agentId, next);
      if (!r.ok) {
        setLocal((p) => ({ ...p, [o.id]: before }));
        setNote({ ok: false, text: r.error });
        return;
      }
      setNote({ ok: true, text: t("agentCardSaved") });
      router.refresh();
    });
  };

  return (
    <SurfaceCard label={t("agentCardTitle")} headingLevel={2}>
      <div className={STACK_CLASS_NAME}>
        <Text size="sm" tone="muted">{t("agentCardHint")}</Text>
        {options.length === 0 ? (
          <Text size="sm">{t("agentCardNone")}</Text>
        ) : (
          options.map((o) => (
            <div key={o.id} className={ACTIONS_CLASS_NAME}>
              <Select
                label={o.label}
                description={<StatusBadge status={o.status} />}
                options={levelOptions.map((l) => ({ ...l, isDisabled: o.status === "disconnected" && l.id !== NONE }))}
                value={accessOf(o) ?? NONE}
                onValueChange={(v) => pick(o, v)}
                isDisabled={!canEdit || pending || !agentId}
              />
            </div>
          ))
        )}
        <div className={ACTIONS_CLASS_NAME}>
          <TextAction href="/connections" size="sm" appearance="inline">{t("agentCardManage")}</TextAction>
          {canEdit ? null : <Text size="xs" tone="muted">{t("agentCardOwnerOnly")}</Text>}
        </div>
        {note ? <Alert title={note.text} tone={note.ok ? "affirmative" : "negative"} /> : null}
      </div>
    </SurfaceCard>
  );
};
