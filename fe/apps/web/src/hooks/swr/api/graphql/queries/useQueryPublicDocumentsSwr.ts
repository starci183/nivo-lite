"use client"

import useSWR from "swr"
import { useWorkspaceKey } from "@/hooks/workspaceKey"
import { queryPublicDocuments } from "@/modules/api/graphql/queries/query-public-documents"

/** The SWR key of the public documents; mutations that change them revalidate the keys that lead with it. */
export const QUERY_PUBLIC_DOCUMENTS_SWR_KEY = "QUERY_PUBLIC_DOCUMENTS_SWR"

/** How often the list is asked again while NIVO is drafting one. */
const DRAFTING_POLL_MS = 3_000

/** The documents written for customers (the back end `publicDocuments` query). Polls only while a row is being drafted. */
export const useQueryPublicDocumentsSwr = (enabled = true) => {
    const key = useWorkspaceKey(QUERY_PUBLIC_DOCUMENTS_SWR_KEY, [], enabled)
    return useSWR(
        key,
        async ({ signal }: { signal?: AbortSignal } = {}) => {
            const result = await queryPublicDocuments({ signal })
            if (!result.data) throw new Error("publicDocuments answered no data")
            return result.data.publicDocuments
        },
        { refreshInterval: (data) => (data?.some((one) => one.status === "drafting") ? DRAFTING_POLL_MS : 0) },
    )
}
