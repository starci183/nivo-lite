"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Alert, Badge, Button, Text } from "@starci/grammar/common"
import { useT } from "@/i18n/client"
import { connections } from "@/i18n/dict/connections"
import { connectionWizard } from "@/i18n/dict/connectionWizard"
import type { Connection } from "@/lib/channels"
import { deleteConnection, disconnectConnection, revealSepayKey, testConnection } from "@/lib/connection-actions"
import { ACTIONS_CLASS, FULL_BOX_CLASS, ROW_CLASS, ROW_MAIN_CLASS } from "./classNames"
import { CopyField } from "./CopyField"
import { StatusBadge } from "./StatusBadge"

/** Props for {@link ConnectionRow}. */
export type ConnectionRowProps = { readonly connection: Connection; readonly agentNames: ReadonlyArray<string>; readonly localOnly: boolean; readonly onContinue?: () => void }

type Note = { tone: "affirmative" | "negative" | "informative"; text: string }

/** One connection: label, facts, status, the agents using it, and Check / Disconnect / Remove. */
export const ConnectionRow = ({ connection: c, agentNames, localOnly, onContinue }: ConnectionRowProps) => {
  const t = useT(connections)
  const tw = useT(connectionWizard)
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [note, setNote] = useState<Note | null>(null)
  const [keys, setKeys] = useState<{ apiKey: string; webhookUrl: string } | null>(null)
  const [confirm, setConfirm] = useState(false)

  const facts =
    c.provider === "telegram" ? (c.meta.bot_username ? `@${c.meta.bot_username}` : "")
    : c.provider === "sepay" || c.provider === "casso" ? [c.meta.bank_code, c.meta.account_masked, c.meta.account_holder].filter(Boolean).join(" · ")
    : c.provider === "payos" ? ""
    : [c.meta.oa_id ? `OA ${c.meta.oa_id}` : "", c.meta.app_id ? `App ${c.meta.app_id}` : ""].filter(Boolean).join(" · ")
  const live = c.status !== "disconnected"
  const needsAgent = live && c.status !== "pending" && agentNames.length === 0
  const isBank = c.provider === "sepay" || c.provider === "payos" || c.provider === "casso"

  const check = () => startTransition(async () => {
    setNote(null)
    const r = await testConnection(c.id)
    if (!r.ok) return setNote({ tone: "negative", text: r.error })
    const d = r.data
    if (d.provider === "zalo_oa") return setNote({ tone: "affirmative", text: t("zaloCheckOk") })
    if (d.provider !== "telegram") return setNote({ tone: "informative", text: t("checkNothing") })
    if (d.localOnly) return setNote({ tone: "informative", text: t("checkLocal") })
    const parts = [d.webhookOk ? t("checkOk", { pending: d.pending }) : t("checkNotRegistered"), d.lastError ? t("checkLastError", { error: d.lastError }) : ""]
    setNote({ tone: d.webhookOk && !d.lastError ? "affirmative" : "negative", text: parts.filter(Boolean).join(" ") })
    router.refresh()
  })
  const disconnect = () => startTransition(async () => {
    setConfirm(false)
    const r = await disconnectConnection(c.id)
    if (!r.ok) return setNote({ tone: "negative", text: r.error })
    router.refresh()
  })
  const remove = () => startTransition(async () => {
    const r = await deleteConnection(c.id)
    if (!r.ok) return setNote({ tone: "negative", text: r.error })
    router.refresh()
  })
  const show = () => startTransition(async () => {
    const r = await revealSepayKey(c.id)
    if (!r.ok) return setNote({ tone: "negative", text: r.error })
    setKeys(r.data)
  })

  return (
    <div className={ROW_CLASS}>
      <div className={ROW_MAIN_CLASS}>
        <Text weight="semibold">{c.name}</Text>
        {facts ? (
          c.provider === "telegram" && c.meta.bot_username
            ? <a className="text-sm underline" href={`https://t.me/${c.meta.bot_username}`} target="_blank" rel="noreferrer">{facts}</a>
            : <Text size="sm" tone="muted">{facts}</Text>
        ) : null}
        <div className={ACTIONS_CLASS}>
          <StatusBadge status={c.status} />
          {c.environment === "test" ? <Badge tone="neutral">{tw("envBadgeTest")}</Badge> : null}
          {needsAgent ? <Badge tone="warning">{t("noAgent")}</Badge> : null}
          {agentNames.length ? <Text size="xs" tone="muted">{t("usedBy", { names: agentNames.join(", ") })}</Text> : null}
        </div>
        {needsAgent ? <Text size="xs" tone="muted">{isBank ? t("noAgentHintBank") : t("noAgentHint")}</Text> : null}
        {c.provider === "telegram" && live && localOnly ? <Text size="xs" tone="muted">{t("localNote")}</Text> : null}
        {c.provider === "zalo_oa" && live ? <Text size="xs" tone="muted">{t("zaloSoon")}</Text> : null}
        {c.lastError && live ? <Text size="xs" tone="muted">{c.lastError}</Text> : null}
      </div>
      <div className={ACTIONS_CLASS}>
        {(c.status === "pending" || (c.status === "error" && c.provider === "zalo_oa")) && onContinue ? <Button variant="secondary" isDisabled={isPending} onPress={onContinue}>{c.provider === "zalo_oa" && c.status === "error" ? tw("zaloReauthorize") : tw("continue")}</Button> : null}
        {c.provider === "sepay" && live && c.status !== "pending" ? <Button variant="outline" isDisabled={isPending} onPress={show}>{t("showKey")}</Button> : null}
        {live && c.status !== "pending" && (c.provider === "telegram" || c.provider === "zalo_oa") ? <Button variant="secondary" isPending={isPending} onPress={check}>{t("check")}</Button> : null}
        {live
          ? <Button variant="danger-soft" isDisabled={isPending} onPress={() => setConfirm(true)}>{t("disconnect")}</Button>
          : <Button variant="danger-soft" isDisabled={isPending} onPress={remove}>{t("remove")}</Button>}
      </div>
      {confirm ? (
        <div className={FULL_BOX_CLASS}>
          <Text size="sm">{t("disconnect")}: {c.name}?</Text>
          <div className={ACTIONS_CLASS}>
            <Button variant="danger" isPending={isPending} onPress={disconnect}>{t("disconnect")}</Button>
            <Button variant="outline" onPress={() => setConfirm(false)}>{t("cancel")}</Button>
          </div>
        </div>
      ) : null}
      {keys ? (
        <div className={FULL_BOX_CLASS}>
          <CopyField label={t("webhookUrl")} value={keys.webhookUrl} />
          <CopyField label={t("apiKey")} value={keys.apiKey} secret />
        </div>
      ) : null}
      {note ? <div className="w-full"><Alert title={note.text} tone={note.tone} /></div> : null}
    </div>
  )
}
