"use client"

import { mutateRequestVideoRender } from "@/modules/api/graphql/mutations/mutation-request-video-render"
import type { mutateRequestVideoRender as MutateRequestVideoRenderOperation } from "@/modules/api/graphql/mutations/mutation-request-video-render"
import { answeredData } from "@/hooks/workspaceread"
import useSWRMutation from "swr/mutation"

/** The SWR key of the requestVideoRender mutation. */
export const MUTATE_REQUEST_VIDEO_RENDER_SWR_KEY = "MUTATE_REQUEST_VIDEO_RENDER_SWR"

/** SWR mutation for {@link mutateRequestVideoRender}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateRequestVideoRenderSwr = () =>
    useSWRMutation(
        MUTATE_REQUEST_VIDEO_RENDER_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateRequestVideoRender({ request: arg }), MUTATE_REQUEST_VIDEO_RENDER_SWR_KEY)
                .requestVideoRender,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: Parameters<typeof MutateRequestVideoRenderOperation>[0]["request"]
}
