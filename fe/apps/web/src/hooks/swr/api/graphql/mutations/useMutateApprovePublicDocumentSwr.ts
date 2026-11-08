"use client"

import useSWRMutation, { type SWRMutationResponse } from "swr/mutation"
import {
    mutateApprovePublicDocument,
    type MutateApprovePublicDocumentRequest,
} from "@/modules/api/graphql/mutations/mutation-approve-public-document"
import type { ApprovePublicDocumentMutation } from "@/modules/api"

/** What the ApprovePublicDocument mutation is triggered with. */
interface ApprovePublicDocumentArg {
    readonly arg: MutateApprovePublicDocumentRequest
}

/** The SWR key of the approvePublicDocument mutation. */
export const MUTATE_APPROVE_PUBLIC_DOCUMENT_SWR_KEY = "MUTATE_APPROVE_PUBLIC_DOCUMENT_SWR"

/** SWR mutation for {@link mutateApprovePublicDocument}: The owner approves a public document, which publishes it. `trigger(input)` rejects with the back end failure. */
export const useMutateApprovePublicDocumentSwr = (): SWRMutationResponse<
    ApprovePublicDocumentMutation["approvePublicDocument"],
    Error,
    typeof MUTATE_APPROVE_PUBLIC_DOCUMENT_SWR_KEY,
    ApprovePublicDocumentArg["arg"]
> =>
    useSWRMutation(MUTATE_APPROVE_PUBLIC_DOCUMENT_SWR_KEY, async (_key: string, { arg }: ApprovePublicDocumentArg) => {
        const result = await mutateApprovePublicDocument({ request: arg })
        if (!result.data) throw new Error("approvePublicDocument answered no data")
        return result.data.approvePublicDocument
    })
