"use client"

import { mutateMarkVideoPublished } from "@/modules/api/graphql/mutations/mutation-mark-video-published"
import type { mutateMarkVideoPublished as MutateMarkVideoPublishedOperation } from "@/modules/api/graphql/mutations/mutation-mark-video-published"
import { answeredData } from "@/hooks/workspaceread"
import useSWRMutation from "swr/mutation"

/** The SWR key of the markVideoPublished mutation. */
export const MUTATE_MARK_VIDEO_PUBLISHED_SWR_KEY = "MUTATE_MARK_VIDEO_PUBLISHED_SWR"

/** SWR mutation for {@link mutateMarkVideoPublished}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateMarkVideoPublishedSwr = () =>
    useSWRMutation(
        MUTATE_MARK_VIDEO_PUBLISHED_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateMarkVideoPublished({ request: arg }), MUTATE_MARK_VIDEO_PUBLISHED_SWR_KEY)
                .markVideoPublished,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: Parameters<typeof MutateMarkVideoPublishedOperation>[0]["request"]
}
