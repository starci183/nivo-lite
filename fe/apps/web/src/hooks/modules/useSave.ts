import { useState, useTransition } from "react"
import type { DbOutcome } from "@/modules/db"
import { navigation } from "@/modules/i18n"

/** What the last save said: nothing yet, saved, or refused with the reason. */
type SaveNote = { readonly tone: "idle" | "saved" | "refused"; readonly text: string }

/** A save that runs one action, keeps its answer for the card to show and refreshes the page when it worked. */
type Save = {
    readonly note: SaveNote
    readonly isPending: boolean
    /** Runs the action; `savedText` is what the card says when it worked, `undo` runs when it was refused. */
    readonly save: (run: () => Promise<DbOutcome<unknown>>, savedText: string, undo?: () => void) => void
}

/** The save of a settings card: one action at a time, its answer kept as a note, the page refreshed after a success. */
export const useSave = (): Save => {
    const router = navigation.useRouter()
    const [note, setNote] = useState<SaveNote>({ tone: "idle", text: "" })
    const [isPending, startTransition] = useTransition()
    const save = (run: () => Promise<DbOutcome<unknown>>, savedText: string, undo?: () => void) => {
        setNote({ tone: "idle", text: "" })
        startTransition(async () => {
            const outcome = await run()
            if (outcome.kind !== "ok") {
                setNote({ tone: "refused", text: outcome.code })
                undo?.()
                return
            }
            setNote({ tone: "saved", text: savedText })
            router.refresh()
        })
    }
    return { note, isPending, save }
}
