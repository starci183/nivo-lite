import { useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { errorKey } from "@/modules/content"
import { navigation } from "@/modules/i18n"

/** The part of a Server Action answer the runner reads: its kind and, for a failure, its code. */
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

/** Runs the Server Actions of a content surface in a transition and keeps their busy flag and message. */
export const useContentCommand = (): ContentCommand => {
    const t = useTranslations("content")
    const router = navigation.useRouter()
    const [isPending, startTransition] = useTransition()
    const [busy, setBusy] = useState<string | null>(null)
    const [note, setNote] = useState<ContentNote | null>(null)
    const explain = (reply: ActionReply): string =>
        t("actionFailed", { error: t(errorKey({ kind: reply.kind, code: reply.code ?? "" })) })
    const run: ContentCommand["run"] = (label, action, onOk) => {
        setBusy(label)
        setNote(null)
        startTransition(async () => {
            try {
                const done = await action()
                if (done.kind === "ok") {
                    onOk?.(done)
                    router.refresh()
                } else {
                    setNote({ tone: "error", text: explain(done) })
                }
            } catch {
                setNote({ tone: "error", text: explain({ kind: "unavailable", code: "transport" }) })
            }
            setBusy(null)
        })
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
