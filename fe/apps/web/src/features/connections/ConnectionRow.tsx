"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Alert, AlertDialog, Badge, Button, DropdownMenu, IconButton, Input, ListRow, Text, TextAction, type DropdownMenuEntry, type DropdownMenuItem } from "@starci/grammar/common"
import { useT } from "@/i18n/client"
import { connections } from "@/i18n/dict/connections"
import { connectionWizard } from "@/i18n/dict/connectionWizard"
import { webhookWizard } from "@/i18n/dict/webhookWizard"
import { googleWizard } from "@/i18n/dict/googleWizard"
import { metaWizard } from "@/i18n/dict/metaWizard"
import { testMeta } from "@/lib/meta-actions"
import { startGoogleConnect } from "@/lib/google-actions"
import { sendWebhookTest } from "@/lib/webhook-actions"
import type { Connection } from "@/lib/channels"
import { deleteConnection, disconnectConnection, revealSepayKey, testConnection } from "@/lib/connection-actions"
import { bankName } from "@/lib/vn-banks"
import { nivoIconSource } from "@/components/leaves/Icon"
import { FULL_BOX_CLASS } from "./classNames"
import { AccountLogo } from "./ProviderLogo"
import { SmtpRowExtras } from "./SmtpRowExtras"
import { StatusBadge } from "./StatusBadge"
import { useCopyField } from "./useCopyField"
import { AgentAccessPicker, type PickerAgent } from "./AgentAccessPicker"
import { syncNow } from "@/lib/data-hub-actions"

/** Props for {@link ConnectionRow}. */
export type ConnectionRowProps = {
  readonly connection: Connection
  readonly agentNames: ReadonlyArray<string>
  readonly localOnly: boolean
  /** Reopen this connection's wizard (bank feeds and Zalo): continue an unfinished one, or edit it. */
  readonly onOpen?: () => void
  readonly ownerEmail?: string
  /** The workspace agents, for the access picker. */
  readonly agents?: ReadonlyArray<PickerAgent>
  /** The workspace owner: may change the connection and who uses it. Everyone else sees the row read-only (checks still run). */
  readonly canManage?: boolean
}

type Note = { tone: "affirmative" | "negative" | "informative"; text: string }
type Busy = "check" | "test" | "google" | "keys" | "disconnect" | "remove" | "sync" | null
type Confirm = "disconnect" | "remove" | null

const MONEY: ReadonlySet<string> = new Set(["sepay", "payos", "casso"])

/**
 * One connection as a list row: name and status, one facts line, an Alert only when something needs acting on, at most one visible
 * action (the one its state calls for), and every other command - destructive ones last, each behind a confirmation - in its menu.
 */
export const ConnectionRow = ({ connection: c, agentNames, localOnly, onOpen, ownerEmail = "", agents = [], canManage = false }: ConnectionRowProps) => {
  const t = useT(connections)
  const tw = useT(connectionWizard)
  const tj = useT(webhookWizard)
  const tg = useT(googleWizard)
  const tm = useT(metaWizard)
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
    DATA.has(c.provider) ? [c.meta.account, c.meta.email, c.meta.host, c.meta.summary].filter(Boolean).join(" · ")
    : c.provider === "smtp" ? [c.meta.from_email, c.meta.host].filter(Boolean).join(" · ")
    : c.provider === "google" ? (c.meta.email ?? "")
    : c.provider === "webhook" ? tj("factsRow", { host: c.meta.host ?? "", count: (c.meta.events ?? "").split(",").filter(Boolean).length })
    : c.provider === "telegram" ? ""
    : c.provider === "sepay" || c.provider === "casso" ? [c.meta.bank_code ? bankName(c.meta.bank_code) : "", c.meta.account_masked, c.meta.account_holder].filter(Boolean).join(" · ")
    : c.provider === "payos" ? ""
    : c.provider === "meta" ? [c.meta.page_name, c.meta.ig_username ? `@${c.meta.ig_username}` : ""].filter(Boolean).join(" · ")
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
    if (c.provider === "meta") {
      const m = await testMeta(c.id)
      if (!m.ok) return setNote({ tone: "negative", text: m.error })
      setNote(m.data.ok ? { tone: "affirmative", text: tm("rowCheckOk", { fields: m.data.page.fields.join(", ") }) } : { tone: "negative", text: m.data.tokenOk ? tm("rowCheckBad") : tm("testToken") })
      router.refresh()
      return
    }
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
  const sync = () => run("sync", async () => {
    const r = await syncNow(c.id)
    setNote(r.ok ? { tone: "affirmative", text: t("syncDone", { rows: r.data.rows }) } : { tone: "negative", text: r.error })
    if (r.ok) router.refresh()
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
  const resumable = canManage && (c.status === "pending" || (c.status === "error" && (c.provider === "zalo_oa" || c.provider === "meta"))) && onOpen
  const primary =
    resumable ? <Button variant="secondary" onPress={onOpen}>{c.provider === "zalo_oa" && c.status === "error" ? tw("zaloReauthorize") : c.provider === "meta" && c.status === "error" ? tm("reconnect") : tw("continue")}</Button>
    : canManage && c.provider === "google" && c.status === "error" ? <Button variant="secondary" isPending={busy === "google"} onPress={reconnectGoogle}>{tg("reconnect")}</Button>
    : live && c.status !== "pending" && (c.provider === "telegram" || c.provider === "zalo_oa" || c.provider === "meta") ? <Button variant="outline" isPending={busy === "check"} onPress={check}>{t("check")}</Button>
    : canManage && live && DATA.has(c.provider) && c.status !== "pending" && c.provider !== "csv_import" ? <Button variant="outline" isPending={busy === "sync"} onPress={sync}>{t("syncNow")}</Button>
    : live && c.provider === "webhook" && c.status !== "pending" ? <Button variant="outline" isPending={busy === "test"} onPress={sendTest}>{tj("sendTest")}</Button>
    : null

  const commands: DropdownMenuItem[] = [
    ...(DATA.has(c.provider) && live && onOpen ? [{ id: "edit", label: t("edit"), onAction: onOpen }] : []),
    ...(isBank && c.status !== "pending" && onOpen ? [{ id: "edit", label: t("edit"), onAction: onOpen }] : []),
    ...(c.provider === "meta" && live && c.status !== "pending" && onOpen ? [{ id: "edit", label: t("edit"), onAction: onOpen }] : []),
    ...(c.provider === "sepay" && live && c.status !== "pending" ? [{ id: "keys", label: t("showKey"), onAction: showKeys }] : []),
  ]
  const entries: DropdownMenuEntry[] = !canManage ? [] : [
    ...(commands.length ? [{ kind: "section" as const, id: "commands", items: commands }] : []),
    {
      kind: "section", id: "danger",
      items: [live
        ? { id: "disconnect", label: t("disconnect"), tone: "negative" as const, onAction: () => setConfirm("disconnect") }
        : { id: "remove", label: t("remove"), tone: "negative" as const, onAction: () => setConfirm("remove") }],
    },
  ]

  const details = [
    needsAgent ? <Alert key="agent" tone="cautionary" title={t("noAgent")} description={isBank ? t("noAgentHintBank") : t("noAgentHint")} /> : null,
    c.lastError && live ? <Alert key="error" tone="negative" title={t("statusError")} description={c.lastError} /> : null,
    c.provider === "telegram" && live && localOnly ? <Text key="local" size="xs" tone="muted">{t("localNote")}</Text> : null,
    c.provider === "zalo_oa" && live ? <Text key="zalo" size="xs" tone="muted">{t("zaloSoon")}</Text> : null,
    c.provider === "smtp" && live ? <SmtpRowExtras key="smtp" connection={c} ownerEmail={ownerEmail} /> : null,
    keys ? (
      <div key="keys" className={FULL_BOX_CLASS}>
        <Input id={`row-${c.id}-url`} name="webhookUrl" label={t("webhookUrl")} variant="secondary" value={keys.webhookUrl} isReadOnly {...copy} />
        <Input id={`row-${c.id}-key`} name="apiKey" label={t("apiKey")} variant="secondary" kind="password" value={keys.apiKey} isReadOnly {...copy} />
      </div>
    ) : null,
    note ? <Alert key="note" title={note.text} tone={note.tone} /> : null,
  ].filter(Boolean)

  return (
    <ListRow
      leading={<AccountLogo connection={c} />}
      title={c.name}
      badges={<><StatusBadge status={c.status} />{c.environment === "test" ? <Badge tone="neutral">{tw("envBadgeTest")}</Badge> : null}</>}
      description={
        c.provider === "telegram" && c.meta.bot_username
          ? <><TextAction href={`https://t.me/${c.meta.bot_username}`} target="_blank">{`@${c.meta.bot_username}`}</TextAction>{usedBy ? ` · ${usedBy}` : ""}</>
          : [facts, usedBy].filter(Boolean).join(" · ") || undefined
      }
      state={c.status === "error" ? "negative" : c.status === "pending" ? "cautionary" : c.status === "disconnected" ? "unavailable" : "neutral"}
      actions={
        <>
          {primary}
          {USES_AGENTS(c.provider) && live ? <AgentAccessPicker connection={c} agents={agents} canEdit={canManage} onError={(text) => setNote({ tone: "negative", text })} /> : null}
          {entries.length ? <DropdownMenu
            placement="bottom end"
            trigger={<IconButton source={nivoIconSource("more", "leading")} label={t("more", { name: c.name })} variant="ghost" isDisabled={busy === "keys"} />}
            entries={entries}
          /> : null}
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
        </>
      }
    >
      {details.length ? details : undefined}
    </ListRow>
  )
}

/** Providers an agent works through (the others are the workspace's own tools: outgoing webhooks, Google, SMTP). */
const USES_AGENTS = (provider: string): boolean => provider !== "webhook" && provider !== "google" && provider !== "smtp"

/** Data connectors: synced into the hub (manual "Sync now" besides the schedule; the CSV import updates by uploading again). */
const DATA: ReadonlySet<string> = new Set(["openapi", "database", "csv_import", "imap", "telegram_user"])
