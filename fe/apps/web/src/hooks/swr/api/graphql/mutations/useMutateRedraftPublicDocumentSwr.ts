"use client"

import useSWRMutation from "swr/mutation"
import { mutateRedraftPublicDocument } from "@/modules/api/graphql/mutations/mutation-redraft-public-document"
import type { MutateRedraftPublicDocumentRequest } from "@/modules/api/graphql/mutations/mutation-redraft-public-document"

/** What the RedraftPublicDocument mutation is triggered with. */
interface RedraftPublicDocumentArg {
    readonly arg: MutateRedraftPublicDocumentRequest
}

/** The SWR key of the redraftPublicDocument mutation. */
export const MUTATE_REDRAFT_PUBLIC_DOCUMENT_SWR_KEY = "MUTATE_REDRAFT_PUBLIC_DOCUMENT_SWR"

/** SWR mutation for {@link mutateRedraftPublicDocument}: NIVO drafts a public document again from its internal sources. `trigger(input)` rejects with the back end failure. */
export const useMutateRedraftPublicDocumentSwr = () =>
    useSWRMutation(MUTATE_REDRAFT_PUBLIC_DOCUMENT_SWR_KEY, async (_key: string, { arg }: RedraftPublicDocumentArg) => {
        const result = await mutateRedraftPublicDocument({ request: arg })
        if (!result.data) throw new Error("redraftPublicDocument answered no data")
        return result.data.redraftPublicDocument
    })
