"use client"

import { mutateRequestVideoScript } from "@/modules/api/graphql/mutations/mutation-request-video-script"
import type { mutateRequestVideoScript as MutateRequestVideoScriptOperation } from "@/modules/api/graphql/mutations/mutation-request-video-script"
import { answeredData } from "@/hooks/workspaceread"
import useSWRMutation from "swr/mutation"

/** The SWR key of the requestVideoScript mutation. */
export const MUTATE_REQUEST_VIDEO_SCRIPT_SWR_KEY = "MUTATE_REQUEST_VIDEO_SCRIPT_SWR"

/** SWR mutation for {@link mutateRequestVideoScript}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateRequestVideoScriptSwr = () =>
    useSWRMutation(
        MUTATE_REQUEST_VIDEO_SCRIPT_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateRequestVideoScript({ request: arg }), MUTATE_REQUEST_VIDEO_SCRIPT_SWR_KEY)
                .requestVideoScript,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: Parameters<typeof MutateRequestVideoScriptOperation>[0]["request"]
}
