"use client"

import {
    mutateRequestVideoRender,
    type mutateRequestVideoRender as MutateRequestVideoRenderOperation,
} from "@/modules/api/graphql/mutations/mutation-request-video-render"
import { answeredData } from "@/hooks/workspaceread"
import useSWRMutation, { type SWRMutationResponse } from "swr/mutation"
import type { RequestVideoRenderMutation } from "@/modules/api"

/** The SWR key of the requestVideoRender mutation. */
export const MUTATE_REQUEST_VIDEO_RENDER_SWR_KEY = "MUTATE_REQUEST_VIDEO_RENDER_SWR"

/** SWR mutation for {@link mutateRequestVideoRender}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateRequestVideoRenderSwr = (): SWRMutationResponse<
    RequestVideoRenderMutation["requestVideoRender"],
    Error,
    typeof MUTATE_REQUEST_VIDEO_RENDER_SWR_KEY,
    TriggerArg["arg"]
> =>
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
