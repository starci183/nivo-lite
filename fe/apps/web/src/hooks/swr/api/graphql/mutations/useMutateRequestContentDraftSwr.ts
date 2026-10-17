"use client"

import { mutateRequestContentDraft } from "@/modules/api/graphql/mutations/mutation-request-content-draft"
import type { mutateRequestContentDraft as MutateRequestContentDraftOperation } from "@/modules/api/graphql/mutations/mutation-request-content-draft"
import { answeredData } from "@/hooks/workspaceread"
import useSWRMutation from "swr/mutation"

/** The SWR key of the requestContentDraft mutation. */
export const MUTATE_REQUEST_CONTENT_DRAFT_SWR_KEY = "MUTATE_REQUEST_CONTENT_DRAFT_SWR"

/** SWR mutation for {@link mutateRequestContentDraft}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateRequestContentDraftSwr = () =>
    useSWRMutation(
        MUTATE_REQUEST_CONTENT_DRAFT_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateRequestContentDraft({ request: arg }), MUTATE_REQUEST_CONTENT_DRAFT_SWR_KEY)
                .requestContentDraft,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: Parameters<typeof MutateRequestContentDraftOperation>[0]["request"]
}
