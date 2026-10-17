"use client"

import { mutateUpdateVideoProject } from "@/modules/api/graphql/mutations/mutation-update-video-project"
import type { MutateUpdateVideoProjectRequest } from "@/modules/api/graphql/mutations/mutation-update-video-project"
import useSWRMutation from "swr/mutation"
import { answeredData } from "@/hooks/workspaceread"

/** The SWR key of the updateVideoProject mutation. */
export const MUTATE_UPDATE_VIDEO_PROJECT_SWR_KEY = "MUTATE_UPDATE_VIDEO_PROJECT_SWR"

/** SWR mutation for {@link mutateUpdateVideoProject}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateUpdateVideoProjectSwr = () =>
    useSWRMutation(
        MUTATE_UPDATE_VIDEO_PROJECT_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateUpdateVideoProject({ request: arg }), MUTATE_UPDATE_VIDEO_PROJECT_SWR_KEY)
                .updateVideoProject,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: MutateUpdateVideoProjectRequest
}
