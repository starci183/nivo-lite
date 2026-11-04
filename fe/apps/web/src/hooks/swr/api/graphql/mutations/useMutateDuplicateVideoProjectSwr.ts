"use client"

import {
    mutateDuplicateVideoProject,
    type mutateDuplicateVideoProject as MutateDuplicateVideoProjectOperation,
} from "@/modules/api/graphql/mutations/mutation-duplicate-video-project"
import { answeredData } from "@/hooks/workspaceread"
import useSWRMutation from "swr/mutation"
import type { SWRMutationResponse } from "swr/mutation"
import type { DuplicateVideoProjectMutation } from "@/modules/api"

/** The SWR key of the duplicateVideoProject mutation. */
export const MUTATE_DUPLICATE_VIDEO_PROJECT_SWR_KEY = "MUTATE_DUPLICATE_VIDEO_PROJECT_SWR"

/** SWR mutation for {@link mutateDuplicateVideoProject}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateDuplicateVideoProjectSwr = (): SWRMutationResponse<
    DuplicateVideoProjectMutation["duplicateVideoProject"],
    Error,
    typeof MUTATE_DUPLICATE_VIDEO_PROJECT_SWR_KEY,
    TriggerArg["arg"]
> =>
    useSWRMutation(
        MUTATE_DUPLICATE_VIDEO_PROJECT_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateDuplicateVideoProject({ request: arg }), MUTATE_DUPLICATE_VIDEO_PROJECT_SWR_KEY)
                .duplicateVideoProject,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: Parameters<typeof MutateDuplicateVideoProjectOperation>[0]["request"]
}
