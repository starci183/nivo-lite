"use client"

import { mutateRequestContentQuickDraft } from "@/modules/api/graphql/mutations/mutation-request-content-quick-draft"
import type { mutateRequestContentQuickDraft as MutateRequestContentQuickDraftOperation } from "@/modules/api/graphql/mutations/mutation-request-content-quick-draft"
import { answeredData } from "@/hooks/workspaceread"
import useSWRMutation from "swr/mutation"
import type { SWRMutationResponse } from "swr/mutation"
import type { OperationData } from "@/hooks/workspaceread"

/** The SWR key of the requestContentQuickDraft mutation. */
export const MUTATE_REQUEST_CONTENT_QUICK_DRAFT_SWR_KEY = "MUTATE_REQUEST_CONTENT_QUICK_DRAFT_SWR"

/** SWR mutation for {@link mutateRequestContentQuickDraft}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateRequestContentQuickDraftSwr = (): SWRMutationResponse<
    OperationData<typeof mutateRequestContentQuickDraft>["requestContentQuickDraft"],
    Error,
    typeof MUTATE_REQUEST_CONTENT_QUICK_DRAFT_SWR_KEY,
    TriggerArg["arg"]
> =>
    useSWRMutation(
        MUTATE_REQUEST_CONTENT_QUICK_DRAFT_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(
                await mutateRequestContentQuickDraft({ request: arg }),
                MUTATE_REQUEST_CONTENT_QUICK_DRAFT_SWR_KEY,
            ).requestContentQuickDraft,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: Parameters<typeof MutateRequestContentQuickDraftOperation>[0]["request"]
}
