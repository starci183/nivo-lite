"use client"

import useSWRMutation from "swr/mutation"
import {
    mutateWritePublicDocument,
    type MutateWritePublicDocumentRequest,
} from "@/modules/api/graphql/mutations/mutation-write-public-document"
import type { SWRMutationResponse } from "swr/mutation"
import type { WritePublicDocumentMutation } from "@/modules/api"

/** What the WritePublicDocument mutation is triggered with. */
interface WritePublicDocumentArg {
    readonly arg: MutateWritePublicDocumentRequest
}

/** The SWR key of the writePublicDocument mutation. */
export const MUTATE_WRITE_PUBLIC_DOCUMENT_SWR_KEY = "MUTATE_WRITE_PUBLIC_DOCUMENT_SWR"

/** SWR mutation for {@link mutateWritePublicDocument}: The owner writes a public document by hand. `trigger(input)` rejects with the back end failure. */
export const useMutateWritePublicDocumentSwr = (): SWRMutationResponse<
    WritePublicDocumentMutation["writePublicDocument"],
    Error,
    typeof MUTATE_WRITE_PUBLIC_DOCUMENT_SWR_KEY,
    WritePublicDocumentArg["arg"]
> =>
    useSWRMutation(MUTATE_WRITE_PUBLIC_DOCUMENT_SWR_KEY, async (_key: string, { arg }: WritePublicDocumentArg) => {
        const result = await mutateWritePublicDocument({ request: arg })
        if (!result.data) throw new Error("writePublicDocument answered no data")
        return result.data.writePublicDocument
    })
