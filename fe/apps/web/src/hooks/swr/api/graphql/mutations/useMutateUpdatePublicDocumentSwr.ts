"use client"

import useSWRMutation from "swr/mutation"
import {
    mutateUpdatePublicDocument,
    type MutateUpdatePublicDocumentRequest,
} from "@/modules/api/graphql/mutations/mutation-update-public-document"
import type { SWRMutationResponse } from "swr/mutation"
import type { UpdatePublicDocumentMutation } from "@/modules/api"

/** What the UpdatePublicDocument mutation is triggered with. */
interface UpdatePublicDocumentArg {
    readonly arg: MutateUpdatePublicDocumentRequest
}

/** The SWR key of the updatePublicDocument mutation. */
export const MUTATE_UPDATE_PUBLIC_DOCUMENT_SWR_KEY = "MUTATE_UPDATE_PUBLIC_DOCUMENT_SWR"

/** SWR mutation for {@link mutateUpdatePublicDocument}: Changes the title or the text of a public document. `trigger(input)` rejects with the back end failure. */
export const useMutateUpdatePublicDocumentSwr = (): SWRMutationResponse<
    UpdatePublicDocumentMutation["updatePublicDocument"],
    Error,
    typeof MUTATE_UPDATE_PUBLIC_DOCUMENT_SWR_KEY,
    UpdatePublicDocumentArg["arg"]
> =>
    useSWRMutation(MUTATE_UPDATE_PUBLIC_DOCUMENT_SWR_KEY, async (_key: string, { arg }: UpdatePublicDocumentArg) => {
        const result = await mutateUpdatePublicDocument({ request: arg })
        if (!result.data) throw new Error("updatePublicDocument answered no data")
        return result.data.updatePublicDocument
    })
