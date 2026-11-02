"use client"

import useSWRMutation from "swr/mutation"
import { mutateDraftPublicDocument } from "@/modules/api/graphql/mutations/mutation-draft-public-document"
import type { MutateDraftPublicDocumentRequest } from "@/modules/api/graphql/mutations/mutation-draft-public-document"

/** What the DraftPublicDocument mutation is triggered with. */
interface DraftPublicDocumentArg {
    readonly arg: MutateDraftPublicDocumentRequest
}

/** The SWR key of the draftPublicDocument mutation. */
export const MUTATE_DRAFT_PUBLIC_DOCUMENT_SWR_KEY = "MUTATE_DRAFT_PUBLIC_DOCUMENT_SWR"

/** SWR mutation for {@link mutateDraftPublicDocument}: NIVO drafts a public document from internal documents, with nobody asking it in a customer chat. `trigger(input)` rejects with the back end failure. */
export const useMutateDraftPublicDocumentSwr = () =>
    useSWRMutation(MUTATE_DRAFT_PUBLIC_DOCUMENT_SWR_KEY, async (_key: string, { arg }: DraftPublicDocumentArg) => {
        const result = await mutateDraftPublicDocument({ request: arg })
        if (!result.data) throw new Error("draftPublicDocument answered no data")
        return result.data.draftPublicDocument
    })
