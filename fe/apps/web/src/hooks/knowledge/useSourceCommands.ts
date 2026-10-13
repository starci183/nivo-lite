import { useState, useTransition } from "react"
import { navigation } from "@/modules/i18n"
import { commandErrorKey, runCommand } from "@/modules/documents"
import type { CommandActions, CommandCall } from "@/modules/documents"
import { KNOWLEDGE_ROUTES } from "@/modules/routes"

/** What a document page can do to the document. */
export type SourceAction = "reindex" | "visibility" | "delete"

/** What the document commands give the block. */
interface SourceCommands {
    /** The action being carried out, or null. */
    readonly busy: SourceAction | null
    /** The catalog key of why the last action failed. */
    readonly errorKey: string | null
    readonly reindex: () => void
    readonly setVisibility: (visibility: "public" | "internal") => void
    readonly remove: () => void
}

/** Reading a document again, changing who may read it and deleting it: each is a command the back end carries out; the page reads again after. */
export const useSourceCommands = (workspaceId: string, sourceId: string, actions: CommandActions): SourceCommands => {
    const router = navigation.useRouter()
    const [busy, setBusy] = useState<SourceAction | null>(null)
    const [errorKey, setErrorKey] = useState<string | null>(null)
    const [, startTransition] = useTransition()
    const act = (action: SourceAction, request: CommandCall, done: () => void) => {
        setErrorKey(null)
        setBusy(action)
        startTransition(async () => {
            const settled = await runCommand(actions, request)
            setBusy(null)
            if (settled.isDone) done()
            else setErrorKey(commandErrorKey(settled.code))
        })
    }
    return {
        busy,
        errorKey,
        reindex: () =>
            act("reindex", { workspaceId, kind: "source.reindex", payload: { sourceId } }, () => router.refresh()),
        setVisibility: (visibility) =>
            act("visibility", { workspaceId, kind: "source.update", payload: { sourceId, visibility } }, () =>
                router.refresh(),
            ),
        remove: () =>
            act("delete", { workspaceId, kind: "source.delete", payload: { sourceId } }, () =>
                router.push(KNOWLEDGE_ROUTES.library),
            ),
    }
}
