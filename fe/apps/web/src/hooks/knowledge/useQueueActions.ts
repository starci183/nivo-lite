"use client"

import { useSWRConfig } from "swr"
import {
    QUERY_KNOWLEDGE_CATEGORIES_SWR_KEY,
    QUERY_KNOWLEDGE_SOURCES_SWR_KEY,
    QUERY_KNOWLEDGE_USAGE_SWR_KEY,
    useMutateCreateKnowledgeUploadSwr,
    useMutateEnqueueKnowledgeSourceSwr,
    usePutPresignedSwr,
    useQueryKnowledgeUsageSwr,
} from "@/hooks/swr"
import {
    quotaFailureOf,
    refusalBeforeUpload,
    type EnqueueItem,
    type EnqueueOutcome,
    type QueueActions,
} from "@/modules/documents"
import { graphQLErrorCode } from "@/modules/failure"
import { useGraphQLWithToast, useRestWithToast } from "@/modules/toast"

/**
 * The queue commands of the add drawer: asks the back end for the presigned address a file goes to, PUTs the bytes to
 * it without the bearer, and hands the document to the job queue through GraphQL. Each failure is toasted; the
 * documents list revalidates when something was queued (through the cache of the viewer, which a global `mutate` never reaches).
 */
export const useQueueActions = (): QueueActions => {
    const { mutate } = useSWRConfig()
    const runGraphQL = useGraphQLWithToast()
    const runRest = useRestWithToast()
    const { trigger: putPresigned } = usePutPresignedSwr()
    const { trigger: askUpload } = useMutateCreateKnowledgeUploadSwr()
    const { trigger: enqueueSource } = useMutateEnqueueKnowledgeSourceSwr()
    const { data: usage } = useQueryKnowledgeUsageSwr()
    const enqueueOutcome = async (item: EnqueueItem): Promise<EnqueueOutcome> => {
        const meta = item.meta
        const asked = await enqueueSource({
            kind: item.kind,
            title: item.title,
            storagePath: item.storagePath,
            url: item.url,
            content: meta.content ?? undefined,
            topic: meta.topic ?? undefined,
            tags: [...meta.tags],
            module: meta.module ?? undefined,
            installationId: meta.installationId ?? undefined,
            origin: meta.origin ?? undefined,
        }).then(
            (queued) => ({ queued, refusal: null }),
            (error: unknown) => ({ queued: undefined, refusal: quotaFailureOf(graphQLErrorCode(error), error), error }),
        )
        if (asked.refusal !== null) return { id: null, refusal: asked.refusal }
        const queued =
            asked.queued ?? (await runGraphQL(() => Promise.reject(asked.error), { showSuccessToast: false }))
        if (queued === undefined) return { id: null }
        await mutate(
            (key) =>
                Array.isArray(key) &&
                (key[0] === QUERY_KNOWLEDGE_SOURCES_SWR_KEY ||
                    key[0] === QUERY_KNOWLEDGE_USAGE_SWR_KEY ||
                    key[0] === QUERY_KNOWLEDGE_CATEGORIES_SWR_KEY),
        )
        return { id: queued.id }
    }
    return {
        upload: async (file, onProgress) => {
            const before = refusalBeforeUpload(file.size, usage?.documents)
            if (before !== null) return { path: null, refusal: { kind: "brain", refusal: before } }
            const asked = await askUpload({ filename: file.name, contentType: file.type, sizeBytes: file.size }).then(
                (address) => ({ address, refusal: null }),
                (error: unknown) => ({
                    address: undefined,
                    refusal: quotaFailureOf(graphQLErrorCode(error), error),
                    error,
                }),
            )
            if (asked.refusal !== null) return { path: null, refusal: asked.refusal }
            const address =
                asked.address ?? (await runGraphQL(() => Promise.reject(asked.error), { showSuccessToast: false }))
            if (address === undefined) return { path: null }
            const sent = await runRest(
                () =>
                    putPresigned({
                        url: address.signedUrl,
                        file,
                        contentType: address.contentType,
                        ...(onProgress === undefined ? {} : { onProgress }),
                    }),
                {
                    showSuccessToast: false,
                },
            )
            return { path: sent === null ? null : address.path }
        },
        enqueue: async (item) => (await enqueueOutcome(item)).id,
        enqueueOutcome,
    }
}
