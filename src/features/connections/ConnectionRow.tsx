"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Alert, AlertDialog, Badge, Button, DropdownMenu, IconButton, Input, Text, TextAction, type DropdownMenuEntry, type DropdownMenuItem } from "@starci/grammar/common"
import { useT } from "@/i18n/client"
import { connections } from "@/i18n/dict/connections"
import { connectionWizard } from "@/i18n/dict/connectionWizard"
import { webhookWizard } from "@/i18n/dict/webhookWizard"
import { googleWizard } from "@/i18n/dict/googleWizard"
import { startGoogleConnect } from "@/lib/google-actions"
import { sendWebhookTest } from "@/lib/webhook-actions"
import type { Connection } from "@/lib/channels"
import { deleteConnection, disconnectConnection, revealSepayKey, testConnection } from "@/lib/connection-actions"
import { bankName } from "@/lib/vn-banks"
import { nivoIconSource } from "@/ui"
import { ACTIONS_CLASS, FULL_BOX_CLASS, META_CLASS, ROW_CLASS, ROW_HEAD_CLASS, ROW_MAIN_CLASS } from "./classNames"
import { BankLogo } from "./ProviderLogo"
import { SmtpRowExtras } from "./SmtpRowExtras"
import { StatusBadge } from "./StatusBadge"
import { useCopyField } from "./useCopyField"

/** Props for {@link ConnectionRow}. */
export type ConnectionRowProps = {
  readonly connection: Connection
  readonly agentNames: ReadonlyArray<string>
  readonly localOnly: boolean
  /** Reopen this connection's wizard (bank feeds and Zalo): continue an unfinished one, or edit it. */
  readonly onOpen?: () => void
  readonly ownerEmail?: string
}

type Note = { tone: "affirmative" | "negative" | "informative"; text: string }
type Busy = "check" | "test" | "google" | "keys" | "disconnect" | "remove" | null
type Confirm = "disconnect" | "remove" | null

const MONEY: ReadonlySet<string> = new Set(["sepay", "payos", "casso"])

/**
 * One connection as a list row: name and status, one facts line, an Alert only when something needs acting on, at most one visible
 * action (the one its state calls for), and every other command - destructive ones last, each behind a confirmation - in its menu.
 */
export const ConnectionRow = ({ connection: c, agentNames, localOnly, onOpen, ownerEmail = "" }: ConnectionRowProps) => {
  const t = useT(connections)
  const tw = useT(connectionWizard)
  const tj = useT(webhookWizard)
  const tg = useT(googleWizard)
  const router = useRouter()
  const copy = useCopyField()
  const [, startTransition] = useTransition()
  const [busy, setBusy] = useState<Busy>(null)
  const [note, setNote] = useState<Note | null>(null)
  const [keys, setKeys] = useState<{ apiKey: string; webhookUrl: string } | null>(null)
  const [confirm, setConfirm] = useState<Confirm>(null)

  const live = c.status !== "disconnected"
  const isBank = MONEY.has(c.provider)
  const needsAgent = live && c.status !== "pending" && c.provider !== "webhook" && c.provider !== "google" && c.provider !== "smtp" && agentNames.length === 0
  const facts =
    c.provider === "smtp" ? [c.meta.from_email, c.meta.host].filter(Boolean).join(" · ")
    : c.provider === "google" ? (c.meta.email ?? "")
    : c.provider === "webhook" ? tj("factsRow", { host: c.meta.host ?? "", count: (c.meta.events ?? "").split(",").filter(Boolean).length })
    : c.provider === "telegram" ? ""
    : c.provider === "sepay" || c.provider === "casso" ? [c.meta.account_masked, c.meta.account_holder].filter(Boolean).join(" · ")
    : c.provider === "payos" ? ""
    : [c.meta.oa_id ? `OA ${c.meta.oa_id}` : "", c.meta.app_id ? `App ${c.meta.app_id}` : ""].filter(Boolean).join(" · ")
  const usedBy = agentNames.length ? t("usedBy", { names: agentNames.join(", ") }) : ""

  /** Run one command; only its own control shows pending. */
  const run = (kind: Exclude<Busy, null>, work: () => Promise<void>) => {
    setBusy(kind)
    setNote(null)
    startTransition(async () => {
      try {
        await work()
      } finally {
        setBusy(null)
      }
    })
  }

  const check = () => run("check", async () => {
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
  const sendTest = () => run("test", async () => {
    const r = await sendWebhookTest(c.id)
    if (!r.ok) return setNote({ tone: "negative", text: r.error })
    setNote(r.data.ok ? { tone: "affirmative", text: tj("testOk", { status: r.data.status ?? "" }) } : { tone: "negative", text: `${tj("testFailed")}. ${r.data.error ?? ""}`.trim() })
  })
  const reconnectGoogle = () => run("google", async () => {
    const r = await startGoogleConnect("/connections")
    if (!r.ok) return setNote({ tone: "negative", text: r.error })
    window.location.assign(r.data.url)
  })
  const showKeys = () => run("keys", async () => {
    const r = await revealSepayKey(c.id)
    if (!r.ok) return setNote({ tone: "negative", text: r.error })
    setKeys(r.data)
  })
  const disconnect = async () => {
    setBusy("disconnect")
    const r = await disconnectConnection(c.id)
    setBusy(null)
    setConfirm(null)
    if (!r.ok) return setNote({ tone: "negative", text: r.error })
    router.refresh()
  }
  const remove = async () => {
    setBusy("remove")
    const r = await deleteConnection(c.id)
    setBusy(null)
    setConfirm(null)
    if (!r.ok) return setNote({ tone: "negative", text: r.error })
    router.refresh()
  }

  // The one visible action: what this connection's state asks for next.
  const resumable = (c.status === "pending" || (c.status === "error" && c.provider === "zalo_oa")) && onOpen
  const primary =
    resumable ? <Button variant="secondary" onPress={onOpen}>{c.provider === "zalo_oa" && c.status === "error" ? tw("zaloReauthorize") : tw("continue")}</Button>
    : c.provider === "google" && c.status === "error" ? <Button variant="secondary" isPending={busy === "google"} onPress={reconnectGoogle}>{tg("reconnect")}</Button>
    : live && c.status !== "pending" && (c.provider === "telegram" || c.provider === "zalo_oa") ? <Button variant="outline" isPending={busy === "check"} onPress={check}>{t("check")}</Button>
    : live && c.provider === "webhook" && c.status !== "pending" ? <Button variant="outline" isPending={busy === "test"} onPress={sendTest}>{tj("sendTest")}</Button>
    : null

  const commands: DropdownMenuItem[] = [
    ...(isBank && c.status !== "pending" && onOpen ? [{ id: "edit", label: t("edit"), onAction: onOpen }] : []),
    ...(c.provider === "sepay" && live && c.status !== "pending" ? [{ id: "keys", label: t("showKey"), onAction: showKeys }] : []),
  ]
  const entries: DropdownMenuEntry[] = [
    ...(commands.length ? [{ kind: "section" as const, id: "commands", items: commands }] : []),
    {
      kind: "section", id: "danger",
      items: [live
        ? { id: "disconnect", label: t("disconnect"), tone: "negative" as const, onAction: () => setConfirm("disconnect") }
        : { id: "remove", label: t("remove"), tone: "negative" as const, onAction: () => setConfirm("remove") }],
    },
  ]

  return (
    <li className={ROW_CLASS}>
      <div className={ROW_HEAD_CLASS}>
        <div className={ROW_MAIN_CLASS}>
          <div className={ACTIONS_CLASS}>
            <Text weight="semibold">{c.name}</Text>
            <StatusBadge status={c.status} />
            {c.environment === "test" ? <Badge tone="neutral">{tw("envBadgeTest")}</Badge> : null}
          </div>
          <div className={META_CLASS}>
            {isBank && c.meta.bank_code ? <BankLogo code={c.meta.bank_code} name={bankName(c.meta.bank_code)} /> : null}
            {c.provider === "telegram" && c.meta.bot_username
              ? <TextAction href={`https://t.me/${c.meta.bot_username}`} target="_blank">{`@${c.meta.bot_username}`}</TextAction>
              : null}
            <Text size="sm" tone="muted">{[facts, usedBy].filter(Boolean).join(" · ")}</Text>
          </div>
        </div>
        <div className={ACTIONS_CLASS}>
          {primary}
          <DropdownMenu
            placement="bottom end"
            trigger={<IconButton source={nivoIconSource("more", "leading")} label={t("more", { name: c.name })} variant="ghost" isDisabled={busy === "keys"} />}
            entries={entries}
          />
        </div>
      </div>

      {needsAgent ? <Alert tone="cautionary" title={t("noAgent")} description={isBank ? t("noAgentHintBank") : t("noAgentHint")} /> : null}
      {c.lastError && live ? <Alert tone="negative" title={t("statusError")} description={c.lastError} /> : null}
      {c.provider === "telegram" && live && localOnly ? <Text size="xs" tone="muted">{t("localNote")}</Text> : null}
      {c.provider === "zalo_oa" && live ? <Text size="xs" tone="muted">{t("zaloSoon")}</Text> : null}
      {c.provider === "smtp" && live ? <SmtpRowExtras connection={c} ownerEmail={ownerEmail} /> : null}

      {keys ? (
        <div className={FULL_BOX_CLASS}>
          <Input
            id={`row-${c.id}-url`} name="webhookUrl" label={t("webhookUrl")} variant="secondary" value={keys.webhookUrl}
            isReadOnly {...copy}
          />
          <Input
            id={`row-${c.id}-key`} name="apiKey" label={t("apiKey")} variant="secondary" kind="password" value={keys.apiKey}
            isReadOnly {...copy}
          />
        </div>
      ) : null}
      {note ? <Alert title={note.text} tone={note.tone} /> : null}

      <AlertDialog
        isOpen={confirm === "disconnect"} onOpenChange={(open) => { if (!open) setConfirm(null) }} tone="negative"
        title={t("disconnectTitle", { name: c.name })} description={t("disconnectBody")}
        confirmLabel={t("disconnect")} cancelLabel={t("cancel")} onConfirm={disconnect} isConfirmPending={busy === "disconnect"}
      />
      <AlertDialog
        isOpen={confirm === "remove"} onOpenChange={(open) => { if (!open) setConfirm(null) }} tone="negative"
        title={t("removeTitle", { name: c.name })} description={t("removeBody")}
        confirmLabel={t("remove")} cancelLabel={t("cancel")} onConfirm={remove} isConfirmPending={busy === "remove"}
      />
    </li>
  )
}
