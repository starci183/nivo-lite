import { useState, useTransition } from "react"
import { commandErrorKey, runCommand } from "@/modules/documents"
import type { CommandActions } from "@/modules/documents"
import { navigation } from "@/modules/i18n"

/** What a card says about the last thing it asked: nothing, how it went, or the catalog key of why it failed. */
interface CommandNote {
    readonly tone: "affirmative" | "negative"
    /** The words of how it went, or the catalog key of why it failed. */
    readonly text: string
}

/** What a card wants to happen when its command went through. */
interface SendOptions {
    /** The words that tell how it went. */
    readonly done?: string
    /** Called with the result the back end gave. */
    readonly onResult?: (result: unknown) => void
}

/** What the brain commands give a card. */
interface BrainCommand {
    readonly isPending: boolean
    readonly note: CommandNote | null
    /** Asks the back end, waits for how it ended and reads the page again when it went through. */
    readonly send: (kind: string, payload: Readonly<Record<string, unknown>>, options?: SendOptions) => void
}

/** A card of the Second Brain that asks the back end to do something: a fact decision, a lesson, a dismissed question. */
export const useBrainCommand = (workspaceId: string, actions: CommandActions): BrainCommand => {
    const router = navigation.useRouter()
    const [isPending, startTransition] = useTransition()
    const [note, setNote] = useState<CommandNote | null>(null)
    const send = (kind: string, payload: Readonly<Record<string, unknown>>, options?: SendOptions) => {
        setNote(null)
        startTransition(async () => {
            const settled = await runCommand(actions, { workspaceId, kind, payload })
            if (!settled.isDone) return setNote({ tone: "negative", text: commandErrorKey(settled.code) })
            if (options?.done !== undefined) setNote({ tone: "affirmative", text: options.done })
            options?.onResult?.(settled.result)
            router.refresh()
        })
    }
    return { isPending, note, send }
}
