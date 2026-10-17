"use client"

import { mutateCreateVideoProject } from "@/modules/api/graphql/mutations/mutation-create-video-project"
import type { MutateCreateVideoProjectRequest } from "@/modules/api/graphql/mutations/mutation-create-video-project"
import { answeredData } from "@/hooks/workspaceread"
import useSWRMutation from "swr/mutation"

/** The SWR key of the createVideoProject mutation. */
export const MUTATE_CREATE_VIDEO_PROJECT_SWR_KEY = "MUTATE_CREATE_VIDEO_PROJECT_SWR"

/** SWR mutation for {@link mutateCreateVideoProject}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateCreateVideoProjectSwr = () =>
    useSWRMutation(
        MUTATE_CREATE_VIDEO_PROJECT_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateCreateVideoProject({ request: arg }), MUTATE_CREATE_VIDEO_PROJECT_SWR_KEY)
                .createVideoProject,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: MutateCreateVideoProjectRequest
}
