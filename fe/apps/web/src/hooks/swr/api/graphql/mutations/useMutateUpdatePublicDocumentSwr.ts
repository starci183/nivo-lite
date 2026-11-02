"use client"

import useSWRMutation from "swr/mutation"
import { mutateUpdatePublicDocument } from "@/modules/api/graphql/mutations/mutation-update-public-document"
import type { MutateUpdatePublicDocumentRequest } from "@/modules/api/graphql/mutations/mutation-update-public-document"

/** What the UpdatePublicDocument mutation is triggered with. */
interface UpdatePublicDocumentArg {
    readonly arg: MutateUpdatePublicDocumentRequest
}

/** The SWR key of the updatePublicDocument mutation. */
export const MUTATE_UPDATE_PUBLIC_DOCUMENT_SWR_KEY = "MUTATE_UPDATE_PUBLIC_DOCUMENT_SWR"

/** SWR mutation for {@link mutateUpdatePublicDocument}: Changes the title or the text of a public document. `trigger(input)` rejects with the back end failure. */
export const useMutateUpdatePublicDocumentSwr = () =>
    useSWRMutation(MUTATE_UPDATE_PUBLIC_DOCUMENT_SWR_KEY, async (_key: string, { arg }: UpdatePublicDocumentArg) => {
        const result = await mutateUpdatePublicDocument({ request: arg })
        if (!result.data) throw new Error("updatePublicDocument answered no data")
        return result.data.updatePublicDocument
    })
