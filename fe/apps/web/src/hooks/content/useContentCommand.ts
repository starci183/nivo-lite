"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { errorKey } from "@/modules/content"
import { useContentRefresh } from "./useContentRefresh"

/** A local UI result; handled failures already have a GraphQL toast. */
export interface ActionReply {
    readonly kind: string
    readonly code?: string
}

/** A message shown after a command. */
export interface ContentNote {
    readonly tone: "ok" | "error"
    readonly text: string
}

/** The state and runner of the commands of one content surface. */
export interface ContentCommand {
    /** True while a command runs. */
    readonly isPending: boolean
    /** The label of the command that runs now, or null. */
    readonly busy: string | null
    /** The last message. */
    readonly note: ContentNote | null
    /** Shows a message. */
    readonly say: (tone: ContentNote["tone"], text: string) => void
    /** Hides the message. */
    readonly dismiss: () => void
    /** Runs a command; on success calls `onOk` with the answer and refreshes the page data, on failure shows the explained failure. */
    readonly run: <R extends ActionReply>(label: string, action: () => Promise<R>, onOk?: (done: R) => void) => void
}

/** Tracks a content command and revalidates browser data when it completes. */
export const useContentCommand = (): ContentCommand => {
    const t = useTranslations("content")
    const { refresh } = useContentRefresh()
    const [isPending, setPending] = useState(false)
    const [busy, setBusy] = useState<string | null>(null)
    const [note, setNote] = useState<ContentNote | null>(null)
    const explain = (reply: ActionReply): string =>
        t("actionFailed", { error: t(errorKey({ kind: reply.kind, code: reply.code ?? "" })) })
    const run: ContentCommand["run"] = (label, action, onOk) => {
        setBusy(label)
        setPending(true)
        setNote(null)
        void (async () => {
            try {
                const done = await action()
                if (done.kind === "ok") {
                    onOk?.(done)
                    await refresh()
                } else if (done.kind !== "handled") {
                    setNote({ tone: "error", text: explain(done) })
                }
            } catch {
                setNote({ tone: "error", text: explain({ kind: "unavailable", code: "transport" }) })
            }
            setBusy(null)
            setPending(false)
        })()
    }
    return {
        isPending,
        busy,
        note,
        say: (tone, text) => setNote({ tone, text }),
        dismiss: () => setNote(null),
        run,
    }
}
