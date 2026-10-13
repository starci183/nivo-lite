import { useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import type { RowBusy, RowConfirm } from "@/hooks/connection-rows"
import type { DbOutcome } from "@/modules/db/outcome"
import { navigation } from "@/modules/i18n"
import type {
    Connection,
    ConnectionCheck,
    GoogleConsent,
    MetaCheckSummary,
    RowNote,
    SepayKeys,
    WebhookTestVerdict,
} from "@/modules/types"
import { useLegacyConnectionCommands } from "./useLegacyConnectionCommands"

/** The commands one connection row can run: the connected block binds the server actions to its connection and hands them in. */
export interface RowCommands {
    readonly check: () => Promise<DbOutcome<ConnectionCheck>>
    readonly checkMeta: () => Promise<DbOutcome<MetaCheckSummary>>
    readonly testWebhook: () => Promise<DbOutcome<WebhookTestVerdict>>
    readonly sepayKeys: () => Promise<DbOutcome<SepayKeys>>
    readonly reconnectGoogle: (returnTo: string) => Promise<DbOutcome<GoogleConsent>>
    readonly disconnect: () => Promise<DbOutcome<true>>
    readonly remove: () => Promise<DbOutcome<true>>
}

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
 * SePay keys and the pending confirmation. A failure arrives as the catalog key of its sentence, read here in the reader's language.
 */
export const useConnectionRowActions = (connection: Connection, commands: RowCommands): ConnectionRowActions => {
    const t = useTranslations("connections")
    const router = navigation.useRouter()
    const legacy = useLegacyConnectionCommands()
    const [, startTransition] = useTransition()
    const [busy, setBusy] = useState<RowBusy>(null)
    const [note, setNote] = useState<RowNote | null>(null)
    const [keys, setKeys] = useState<SepayKeys | null>(null)
    const [confirm, setConfirm] = useState<RowConfirm>(null)

    const sentence = (code: string): string => t(code, { agent: "", connection: "" })
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
        if (result.kind !== "ok") return setNote({ tone: "negative", text: sentence(result.code) })
        const verdict = result.value
        if (verdict.ok)
            setNote({ tone: "affirmative", text: t("metaRowCheckOk", { fields: verdict.page.fields.join(", ") }) })
        else setNote({ tone: "negative", text: verdict.tokenOk ? t("metaRowCheckBad") : t("metaTestToken") })
        router.refresh()
    }
    const checkProvider = async () => {
        const result = await commands.check()
        if (result.kind !== "ok") return setNote({ tone: "negative", text: sentence(result.code) })
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
        router.refresh()
    }
    const sendTest = async () => {
        const result = await commands.testWebhook()
        if (result.kind !== "ok") return setNote({ tone: "negative", text: sentence(result.code) })
        const sent = result.value
        if (sent.ok) setNote({ tone: "affirmative", text: t("webhookTestOk", { status: sent.status ?? "" }) })
        else setNote({ tone: "negative", text: `${t("webhookTestFailed")}. ${sent.error ?? ""}`.trim() })
    }
    const reconnectGoogle = async () => {
        const result = await commands.reconnectGoogle("/connections")
        if (result.kind !== "ok") return setNote({ tone: "negative", text: sentence(result.code) })
        window.location.assign(result.value.url)
    }
    const sync = async () => {
        const result = await legacy.syncNow(connection.id)
        if (!result.ok) return setNote({ tone: "negative", text: result.error })
        setNote({ tone: "affirmative", text: t("syncDone", { rows: result.data.rows }) })
        router.refresh()
    }
    const showKeys = async () => {
        const result = await commands.sepayKeys()
        if (result.kind !== "ok") return setNote({ tone: "negative", text: sentence(result.code) })
        setKeys(result.value)
    }
    const finish = async (kind: "disconnect" | "remove", work: () => Promise<DbOutcome<true>>) => {
        setBusy(kind)
        const result = await work()
        setBusy(null)
        setConfirm(null)
        if (result.kind === "ok") router.refresh()
        else setNote({ tone: "negative", text: sentence(result.code) })
    }

    return {
        busy,
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
