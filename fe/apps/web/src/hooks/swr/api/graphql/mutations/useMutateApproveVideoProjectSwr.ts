"use client"

import { mutateApproveVideoProject } from "@/modules/api/graphql/mutations/mutation-approve-video-project"
import type { mutateApproveVideoProject as MutateApproveVideoProjectOperation } from "@/modules/api/graphql/mutations/mutation-approve-video-project"
import { answeredData } from "@/hooks/workspaceread"
import useSWRMutation from "swr/mutation"

/** The SWR key of the approveVideoProject mutation. */
export const MUTATE_APPROVE_VIDEO_PROJECT_SWR_KEY = "MUTATE_APPROVE_VIDEO_PROJECT_SWR"

/** SWR mutation for {@link mutateApproveVideoProject}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateApproveVideoProjectSwr = () =>
    useSWRMutation(
        MUTATE_APPROVE_VIDEO_PROJECT_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateApproveVideoProject({ request: arg }), MUTATE_APPROVE_VIDEO_PROJECT_SWR_KEY)
                .approveVideoProject,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: Parameters<typeof MutateApproveVideoProjectOperation>[0]["request"]
}
