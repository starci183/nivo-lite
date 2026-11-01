"use client"

import { useState } from "react"
import { useSWRConfig } from "swr"
import {
    QUERY_KNOWLEDGE_SOURCE_SWR_KEY,
    QUERY_BRAIN_DOSSIERS_SWR_KEY,
    QUERY_KNOWLEDGE_CATEGORIES_SWR_KEY,
    QUERY_KNOWLEDGE_SOURCES_SWR_KEY,
    QUERY_KNOWLEDGE_USAGE_SWR_KEY,
    useMutateDeleteKnowledgeSourceSwr,
    useMutateReindexKnowledgeSourceSwr,
    useMutateUpdateKnowledgeSourceSwr,
} from "@/hooks/swr"
import { navigation } from "@/modules/i18n"
import { KNOWLEDGE_ROUTES } from "@/modules/routes"
import { useGraphQLWithToast } from "@/modules/toast"

/** What a document page can do to the document. */
export type SourceAction = "reindex" | "visibility" | "delete"

/** What the document commands give the block. */
interface SourceCommands {
    /** The action being carried out, or null. */
    readonly busy: SourceAction | null
    readonly reindex: () => void
    readonly setVisibility: (visibility: "public" | "internal") => void
    readonly remove: () => void
}

/** Reads the lists a document change touches again, through the mutate of the viewer's cache (a global one never reaches it). */
const revalidateDocuments = (mutate: ReturnType<typeof useSWRConfig>["mutate"]) =>
    mutate(
        (key) =>
            Array.isArray(key) &&
            (key[0] === QUERY_KNOWLEDGE_SOURCE_SWR_KEY ||
                key[0] === QUERY_KNOWLEDGE_SOURCES_SWR_KEY ||
                key[0] === QUERY_KNOWLEDGE_CATEGORIES_SWR_KEY ||
                key[0] === QUERY_BRAIN_DOSSIERS_SWR_KEY ||
                key[0] === QUERY_KNOWLEDGE_USAGE_SWR_KEY),
    )

/** Reading a document again, changing who may read it and deleting it; each failure is toasted, the lists revalidate. */
export const useSourceCommands = (sourceId: string): SourceCommands => {
    const router = navigation.useRouter()
    const { mutate } = useSWRConfig()
    const runGraphQL = useGraphQLWithToast()
    const { trigger: reindexSource } = useMutateReindexKnowledgeSourceSwr()
    const { trigger: updateSource } = useMutateUpdateKnowledgeSourceSwr()
    const { trigger: deleteSource } = useMutateDeleteKnowledgeSourceSwr()
    const [busy, setBusy] = useState<SourceAction | null>(null)
    const act = (action: SourceAction, run: () => Promise<unknown>, done: () => void) => {
        setBusy(action)
        void runGraphQL(run, { showSuccessToast: false }).then(async (result) => {
            setBusy(null)
            if (result === undefined) return
            await revalidateDocuments(mutate)
            done()
        })
    }
    return {
        busy,
        reindex: () =>
            act(
                "reindex",
                () => reindexSource({ sourceId }),
                () => undefined,
            ),
        setVisibility: (visibility) =>
            act(
                "visibility",
                () => updateSource({ sourceId, visibility }),
                () => undefined,
            ),
        remove: () =>
            act(
                "delete",
                () => deleteSource({ id: sourceId }),
                () => router.push(KNOWLEDGE_ROUTES.library),
            ),
    }
}
