import { useState, useTransition } from "react"
import type { DbOutcome } from "@/modules/db"
import { navigation } from "@/modules/i18n"
import type { IdeaDecision } from "@/modules/types"

/** One decision on a suggestion; no decision brings the suggestion back. */
interface IdeaInput {
    readonly workspaceId: string
    readonly key: string
    readonly state: IdeaDecision | null
}

/** The server actions the library commands go through, passed in by the connected block. */
export interface LibraryActions {
    readonly retry: (sourceId: string) => Promise<DbOutcome<string>>
    readonly decide: (input: IdeaInput) => Promise<DbOutcome<null>>
}

/** What the library page commands give the block. */
interface LibraryCommands {
    readonly retrying: ReadonlySet<string>
    readonly isRetryFailed: boolean
    readonly isPending: boolean
    readonly retry: (sourceId: string) => void
    readonly decide: (key: string, state: IdeaDecision | null) => void
}

/** Retrying a failed document and deciding a suggestion; the page reads its data again after each. */
export const useLibraryCommands = (workspaceId: string, actions: LibraryActions): LibraryCommands => {
    const router = navigation.useRouter()
    const [retrying, setRetrying] = useState<ReadonlySet<string>>(new Set())
    const [isRetryFailed, setRetryFailed] = useState(false)
    const [isPending, startTransition] = useTransition()
    const retry = (sourceId: string) => {
        setRetryFailed(false)
        setRetrying((now) => new Set(now).add(sourceId))
        void actions.retry(sourceId).then((outcome) => {
            if (outcome.kind !== "ok") setRetryFailed(true)
            setRetrying((now) => new Set([...now].filter((id) => id !== sourceId)))
        })
    }
    const decide = (key: string, state: IdeaDecision | null) =>
        startTransition(async () => {
            await actions.decide({ workspaceId, key, state })
            router.refresh()
        })
    return { retrying, isRetryFailed, isPending, retry, decide }
}
