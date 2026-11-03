"use client"

import {
    mutateMarkContentPublished,
    type mutateMarkContentPublished as MutateMarkContentPublishedOperation,
} from "@/modules/api/graphql/mutations/mutation-mark-content-published"
import { answeredData } from "@/hooks/workspaceread"
import useSWRMutation from "swr/mutation"
import type { SWRMutationResponse } from "swr/mutation"
import type { MarkContentPublishedMutation } from "@/modules/api"

/** The SWR key of the markContentPublished mutation. */
export const MUTATE_MARK_CONTENT_PUBLISHED_SWR_KEY = "MUTATE_MARK_CONTENT_PUBLISHED_SWR"

/** SWR mutation for {@link mutateMarkContentPublished}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateMarkContentPublishedSwr = (): SWRMutationResponse<
    MarkContentPublishedMutation["markContentPublished"],
    Error,
    typeof MUTATE_MARK_CONTENT_PUBLISHED_SWR_KEY,
    TriggerArg["arg"]
> =>
    useSWRMutation(
        MUTATE_MARK_CONTENT_PUBLISHED_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateMarkContentPublished({ request: arg }), MUTATE_MARK_CONTENT_PUBLISHED_SWR_KEY)
                .markContentPublished,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: Parameters<typeof MutateMarkContentPublishedOperation>[0]["request"]
}
