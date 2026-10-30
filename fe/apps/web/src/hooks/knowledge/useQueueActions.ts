"use client"

import { mutate } from "swr"
import {
    QUERY_KNOWLEDGE_SOURCES_SWR_KEY,
    QUERY_KNOWLEDGE_USAGE_SWR_KEY,
    useMutateCreateKnowledgeUploadSwr,
    useMutateEnqueueKnowledgeSourceSwr,
    usePutPresignedSwr,
} from "@/hooks/swr"
import type { QueueActions } from "@/modules/documents"
import { useGraphQLWithToast, useRestWithToast } from "@/modules/toast"

/**
 * The queue commands of the add drawer: asks the back end for the presigned address a file goes to, PUTs the bytes to
 * it without the bearer, and hands the document to the job queue through GraphQL. Each failure is toasted; the
 * documents list revalidates when something was queued.
 */
export const useQueueActions = (): QueueActions => {
    const runGraphQL = useGraphQLWithToast()
    const runRest = useRestWithToast()
    const { trigger: putPresigned } = usePutPresignedSwr()
    const { trigger: askUpload } = useMutateCreateKnowledgeUploadSwr()
    const { trigger: enqueueSource } = useMutateEnqueueKnowledgeSourceSwr()
    return {
        upload: async (file) => {
            const address = await runGraphQL(() => askUpload({ filename: file.name }), {
                showSuccessToast: false,
            })
            if (address === undefined) return null
            const sent = await runRest(() => putPresigned({ url: address.signedUrl, file }), {
                showSuccessToast: false,
            })
            return sent === null ? null : address.path
        },
        enqueue: async (item) => {
            const meta = item.meta
            const queued = await runGraphQL(
                () =>
                    enqueueSource({
                        kind: item.kind,
                        title: item.title,
                        storagePath: item.storagePath,
                        url: item.url,
                        content: meta.content ?? undefined,
                        topic: meta.topic ?? undefined,
                        tags: [...meta.tags],
                        visibility: meta.visibility,
                        module: meta.module ?? undefined,
                        installationId: meta.installationId ?? undefined,
                        origin: meta.origin ?? undefined,
                    }),
                { showSuccessToast: false },
            )
            if (queued === undefined) return false
            await mutate(
                (key) =>
                    Array.isArray(key) &&
                    (key[0] === QUERY_KNOWLEDGE_SOURCES_SWR_KEY || key[0] === QUERY_KNOWLEDGE_USAGE_SWR_KEY),
            )
            return true
        },
    }
}
