"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import {
    QUERY_KNOWLEDGE_SOURCE_SWR_KEY,
    QUERY_BRAIN_DOSSIERS_SWR_KEY,
    QUERY_KNOWLEDGE_CATEGORIES_SWR_KEY,
    QUERY_KNOWLEDGE_SOURCES_SWR_KEY,
    QUERY_KNOWLEDGE_USAGE_SWR_KEY,
    QUERY_PUBLIC_DOCUMENTS_SWR_KEY,
    QUERY_BRAIN_SWR_KEY,
    QUERY_BRAIN_TODO_SWR_KEY,
    useMutateDeleteKnowledgeSourceSwr,
    useMutateReindexKnowledgeSourceSwr,
} from "@/hooks/swr"
import { useWorkspaceKey } from "@/hooks/workspaceKey"
import { mutate } from "@/modules/viewer-cache"
import { navigation } from "@/modules/i18n"
import { KNOWLEDGE_ROUTES } from "@/modules/routes"
import { toast, useGraphQLWithToast } from "@/modules/toast"

/** What a document page can do to the document. */
export type SourceAction = "reindex" | "delete"

/** What the document commands give the block. */
interface SourceCommands {
    /** The action being carried out, or null. */
    readonly busy: SourceAction | null
    readonly reindex: () => void
    readonly remove: () => Promise<void>
}

/** Reads the lists a document change touches again, through the mutate of the viewer's cache (a global one never reaches it). */
const revalidateDocuments = (workspaceId: string) =>
    mutate(
        (key) =>
            Array.isArray(key) &&
            key[1] === workspaceId &&
            (key[0] === QUERY_KNOWLEDGE_SOURCE_SWR_KEY ||
                key[0] === QUERY_KNOWLEDGE_SOURCES_SWR_KEY ||
                key[0] === QUERY_KNOWLEDGE_CATEGORIES_SWR_KEY ||
                key[0] === QUERY_BRAIN_DOSSIERS_SWR_KEY ||
                key[0] === QUERY_KNOWLEDGE_USAGE_SWR_KEY ||
                key[0] === QUERY_PUBLIC_DOCUMENTS_SWR_KEY ||
                key[0] === QUERY_BRAIN_SWR_KEY ||
                key[0] === QUERY_BRAIN_TODO_SWR_KEY),
    )

/** Reading a document again and deleting it; each failure is toasted, the lists revalidate. */
export const useSourceCommands = (sourceId: string): SourceCommands => {
    const router = navigation.useRouter()
    const workspaceKey = useWorkspaceKey(QUERY_KNOWLEDGE_SOURCES_SWR_KEY, [])
    const runGraphQL = useGraphQLWithToast()
    const feedback = useTranslations("toast")
    const { trigger: reindexSource } = useMutateReindexKnowledgeSourceSwr()
    const { trigger: deleteSource } = useMutateDeleteKnowledgeSourceSwr()
    const [busy, setBusy] = useState<SourceAction | null>(null)
    const failed = () => {
        toast.danger(feedback("errorTitle"), { description: feedback("defaultError") })
    }
    const act = async (action: SourceAction, run: () => Promise<unknown>, done: () => void) => {
        if (workspaceKey === null) {
            failed()
            return undefined
        }
        setBusy(action)
        try {
            const result = await runGraphQL(run, { showSuccessToast: false })
            if (result === undefined) return undefined
            if (result === false) {
                failed()
                return undefined
            }
            await revalidateDocuments(workspaceKey[1])
            done()
            return true
        } catch {
            failed()
            return undefined
        } finally {
            setBusy(null)
        }
    }
    return {
        busy,
        reindex: () => {
            act(
                "reindex",
                () => reindexSource({ sourceId }),
                () => undefined,
            ).catch(failed)
        },
        remove: async () => {
            const removed = await act(
                "delete",
                () => deleteSource({ id: sourceId }),
                () => router.push(KNOWLEDGE_ROUTES.library),
            )
            if (removed !== true) throw new Error("knowledge source deletion did not succeed")
        },
    }
}
