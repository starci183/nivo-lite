"use client"

import type { RowBusy, RowConfirm } from "@/hooks/connection-rows"
import type { Settled } from "@/hooks/connection-wizard"
import type { Connection, RowNote, SepayKeys } from "@/modules/types"
import { useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { useConnectionRowCommands } from "./useConnectionRowCommands"
import { useSyncNow } from "./useSyncNow"

/** Whether two row notes say the same thing. A finished sync builds a new object on every read. */
const sameRowNote = (left: RowNote | null, right: RowNote | null): boolean =>
    left === right || (left !== null && right !== null && left.tone === right.tone && left.text === right.text)

/** The state and commands of one connection row. */
export interface ConnectionRowActions {
    readonly busy: RowBusy
    readonly note: RowNote | null
    readonly keys: SepayKeys | null
    readonly confirm: RowConfirm
    readonly setConfirm: (value: RowConfirm) => void
    readonly setNote: (value: RowNote | null) => void
    readonly check: () => void
    readonly sendTest: () => void
    readonly reconnectGoogle: () => void
    readonly sync: () => void
    readonly showKeys: () => void
    readonly disconnect: () => void
    readonly remove: () => void
}

/**
 * Runs a row's commands one at a time and keeps what the row shows afterwards: the busy control, the result line, the revealed
 * SePay keys and the pending confirmation. A failure arrives as the back end message, already in the reader's language.
 */
export const useConnectionRowActions = (connection: Connection): ConnectionRowActions => {
    const t = useTranslations("connections")
    const commands = useConnectionRowCommands(connection.id, connection.provider)
    const syncNow = useSyncNow()
    const [, startTransition] = useTransition()
    const [busy, setBusy] = useState<RowBusy>(null)
    const [note, setNote] = useState<RowNote | null>(null)
    const [synced, setSynced] = useState<RowNote | null>(null)
    const [keys, setKeys] = useState<SepayKeys | null>(null)
    const [confirm, setConfirm] = useState<RowConfirm>(null)
    const outcome = syncNow.outcome
    if (!sameRowNote(outcome, synced)) {
        setSynced(outcome)
        if (outcome !== null) setNote(outcome)
    }

    const run = (kind: Exclude<RowBusy, null>, work: () => Promise<void>) => {
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

    const checkMeta = async () => {
        const result = await commands.checkMeta()
        if (result.kind !== "ok") return setNote({ tone: "negative", text: result.message })
        const verdict = result.value
        if (verdict.ok)
            setNote({ tone: "affirmative", text: t("metaRowCheckOk", { fields: verdict.page.fields.join(", ") }) })
        else setNote({ tone: "negative", text: verdict.tokenOk ? t("metaRowCheckBad") : t("metaTestToken") })
    }
    const checkProvider = createProviderCheck(commands, setNote, t)
    const sendTest = async () => {
        const result = await commands.testWebhook()
        if (result.kind !== "ok") return setNote({ tone: "negative", text: result.message })
        const sent = result.value
        if (sent.ok) setNote({ tone: "affirmative", text: t("webhookTestOk", { status: sent.status ?? "" }) })
        else setNote({ tone: "negative", text: `${t("webhookTestFailed")}. ${sent.error ?? ""}`.trim() })
    }
    const reconnectGoogle = async () => {
        const result = await commands.reconnectGoogle("/connections")
        if (result.kind !== "ok") return setNote({ tone: "negative", text: result.message })
        window.location.assign(result.value)
    }
    const sync = () => syncNow.start(connection.id)
    const showKeys = async () => {
        const result = await commands.sepayKeys()
        if (result.kind !== "ok") return setNote({ tone: "negative", text: result.message })
        setKeys(result.value)
    }
    const finish = async (kind: "disconnect" | "remove", work: () => Promise<Settled<true>>) => {
        setBusy(kind)
        const result = await work()
        setBusy(null)
        setConfirm(null)
        if (result.kind !== "ok") setNote({ tone: "negative", text: result.message })
    }

    return {
        busy: syncNow.isRunning ? "sync" : busy,
        note,
        keys,
        confirm,
        setConfirm,
        setNote,
        check: () => run("check", connection.provider === "meta" ? checkMeta : checkProvider),
        sendTest: () => run("test", sendTest),
        reconnectGoogle: () => run("google", reconnectGoogle),
        sync: () => run("sync", sync),
        showKeys: () => run("keys", showKeys),
        disconnect: () => void finish("disconnect", commands.disconnect),
        remove: () => void finish("remove", commands.remove),
    }
}

/** Builds the checkProvider command from the current render state. */
const createProviderCheck =
    (
        commands: ReturnType<typeof useConnectionRowCommands>,
        setNote: (note: RowNote | null) => void,
        t: ReturnType<typeof useTranslations<"connections">>,
    ) =>
    async () => {
        const result = await commands.check()
        if (result.kind !== "ok") return setNote({ tone: "negative", text: result.message })
        const check = result.value
        if (check.provider === "zalo_oa") return setNote({ tone: "affirmative", text: t("zaloCheckOk") })
        if (check.provider !== "telegram") return setNote({ tone: "informative", text: t("checkNothing") })
        if (check.localOnly) return setNote({ tone: "informative", text: t("checkLocal") })
        const parts = [
            check.webhookOk ? t("checkOk", { pending: check.pending }) : t("checkNotRegistered"),
            check.lastError === null ? "" : t("checkLastError", { error: check.lastError }),
        ]
        setNote({
            tone: check.webhookOk && check.lastError === null ? "affirmative" : "negative",
            text: parts.filter(Boolean).join(" "),
        })
    }
