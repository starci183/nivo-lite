"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button, DropdownMenu, Text, type DropdownMenuEntry } from "@starci/grammar/common"
import { useT } from "@/i18n/client"
import { connections as dict } from "@/i18n/dict/connections"
import type { Connection } from "@/lib/channels"
import { ACCESS_LEVELS, purposeFor, type Access } from "@/lib/connection-access"
import { setGrant } from "@/lib/connection-actions"

/** An agent the picker can offer. */
export type PickerAgent = { readonly id: string; readonly name: string; readonly module: string }

/** Props for {@link AgentAccessPicker}. */
export type AgentAccessPickerProps = {
  readonly connection: Connection
  readonly agents: ReadonlyArray<PickerAgent>
  /** Only the workspace owner edits; everyone else reads the same summary. */
  readonly canEdit: boolean
  readonly onError?: (message: string) => void
}

const NONE = "none"

/**
 * "Which agents work through this connection, and how far": one menu, one section per agent with No access / Read only / Ask first /
 * Act within the rules. Each pick is saved at once (setGrant) and is the same grant the agent's own settings show. Agents whose
 * module cannot use this kind of connection are listed disabled, with the reason.
 */
export const AgentAccessPicker = ({ connection: c, agents, canEdit, onError }: AgentAccessPickerProps) => {
  const t = useT(dict)
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [local, setLocal] = useState<Readonly<Record<string, Access | null>>>({})
  const accessOf = (agentId: string): Access | null =>
    agentId in local ? (local[agentId] ?? null) : (c.grants.find((g) => g.agentId === agentId)?.access ?? null)

  const level = (a: Access | null) => (a === null ? t("accessNone") : t(`access_${a}`))
  const granted = agents.filter((a) => accessOf(a.id) !== null)
  const summary = granted.length === 0 ? t("accessNobody") : granted.map((a) => `${a.name} (${level(accessOf(a.id))})`).join(", ")

  if (!canEdit) return <Text size="sm" tone="muted">{t("accessReadOnly", { summary })}</Text>

  const pick = (agentId: string, value: Access | null) => {
    const before = accessOf(agentId)
    if (before === value) return
    setLocal((p) => ({ ...p, [agentId]: value }))
    startTransition(async () => {
      const r = await setGrant(c.id, agentId, value)
      if (!r.ok) {
        setLocal((p) => ({ ...p, [agentId]: before }))
        onError?.(r.error)
        return
      }
      router.refresh()
    })
  }

  const entries: ReadonlyArray<DropdownMenuEntry> = agents.map((a) => {
    const usable = purposeFor(a.module, c.provider) !== null
    const current = accessOf(a.id)
    return {
      kind: "section" as const,
      id: `agent-${a.id}`,
      label: a.name,
      items: usable
        ? [NONE, ...ACCESS_LEVELS].map((v) => ({
            id: `${a.id}:${v}`,
            label: v === NONE ? t("accessNone") : t(`access_${v as Access}`),
            description: v === NONE ? undefined : t(`accessHint_${v as Access}`),
          }))
        : [{ id: `${a.id}:unusable`, label: t("accessUnusable"), isDisabled: true }],
      ...(usable
        ? {
            selection: {
              mode: "single" as const,
              selectedIds: [`${a.id}:${current ?? NONE}`],
              onChange: (ids: ReadonlyArray<string>) => {
                const picked = ids[0]?.split(":")[1]
                if (picked) pick(a.id, picked === NONE ? null : (picked as Access))
              },
            },
          }
        : {}),
    }
  })

  return (
    <DropdownMenu
      placement="bottom end"
      trigger={
        <Button variant="outline" size="sm" isPending={pending}>
          {granted.length === 0 ? t("accessAssign") : t("accessButton", { count: granted.length })}
        </Button>
      }
      entries={entries.length ? entries : [{ id: "no-agents", label: t("accessNoAgents"), isDisabled: true }]}
    />
  )
}
