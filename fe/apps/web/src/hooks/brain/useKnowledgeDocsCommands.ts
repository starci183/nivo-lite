"use client"

import { useDocsAddress } from "@/hooks/knowledge"
import { navigation } from "@/modules/i18n"
import { docTabOf, docsTailOf } from "@/modules/documents"
import { brainTabHref, KNOWLEDGE_ROUTES, knowledgeSourceHref, workspaceHref } from "@/modules/routes"
import type { DocsSelection, KnowledgeDocsView } from "@/modules/types"
import { useWorkspaceId } from "@/hooks/workspaces"

/** What the commands of the documents screen act on. */
interface DocsCommandsInput {
    readonly selection: DocsSelection
    readonly selectTab: (id: string) => void
    /** Reads again every read the screen is made of. */
    readonly reloads: ReadonlyArray<() => void>
    /** What the open document can do: read again, delete, and the commands of its row. */
    readonly doc: {
        readonly reindex: () => void
        readonly remove: () => Promise<void>
        readonly row: (sourceId: string, actionId: string) => void
    }
    readonly ideas: Pick<KnowledgeDocsView["on"], "idea" | "moreIdeas">
    /** The overlays of the screen: the delete confirmation. */
    readonly overlays: {
        readonly openRemove: () => void
        readonly setRemoveOpen: (isOpen: boolean) => void
    }
    readonly hideAside: () => void
}

/** The commands of the documents screen: moving between rows and filters (the address keeps them), and what the open document can do. */
export const useKnowledgeDocsCommands = (input: DocsCommandsInput): KnowledgeDocsView["on"] => {
    const router = navigation.useRouter()
    const workspaceId = useWorkspaceId()
    const address = useDocsAddress()
    const { selection } = input
    const carried = address.carried
    return {
        selectTab: input.selectTab,
        select: (id) =>
            router.push(
                workspaceHref(
                    workspaceId,
                    selection.kind === "nivo"
                        ? `${KNOWLEDGE_ROUTES.nivo}${docsTailOf({ ...carried, item: id })}`
                        : `${knowledgeSourceHref(id)}${docsTailOf(carried)}`,
                ),
            ),
        search: address.setQuery,
        setTab: (id) => {
            if (id === "nivo") router.push(workspaceHref(workspaceId, `${KNOWLEDGE_ROUTES.nivo}${docsTailOf(carried)}`))
            else if (selection.kind === "nivo")
                router.push(workspaceHref(workspaceId, brainTabHref("sources", { ...carried, filter: id })))
            else address.setTab(docTabOf(id))
        },
        setModule: address.setModule,
        clear: () => {
            address.setQuery("")
            address.setModule("all")
            address.setTab("all")
        },
        back: () =>
            router.push(
                workspaceHref(
                    workspaceId,
                    selection.kind === "nivo"
                        ? `${KNOWLEDGE_ROUTES.nivo}${docsTailOf({ ...carried, item: undefined })}`
                        : brainTabHref("sources", carried),
                ),
            ),
        retry: () => input.reloads.forEach((reload) => reload()),
        add: () => router.push(workspaceHref(workspaceId, brainTabHref("sources", { ...carried, add: "upload" }))),
        reindex: input.doc.reindex,
        menu: (id) => {
            if (id === "delete") input.overlays.openRemove()
            else if (selection.kind === "doc" && selection.id !== undefined) input.doc.row(selection.id, id)
        },
        removeOpenChange: input.overlays.setRemoveOpen,
        remove: input.doc.remove,
        closeAside: input.hideAside,
        idea: input.ideas.idea,
        moreIdeas: input.ideas.moreIdeas,
    }
}
