"use client"

import { mutateShareVideoProject } from "@/modules/api/graphql/mutations/mutation-share-video-project"
import type { mutateShareVideoProject as MutateShareVideoProjectOperation } from "@/modules/api/graphql/mutations/mutation-share-video-project"
import useSWRMutation from "swr/mutation"
import { answeredData } from "@/hooks/workspaceread"

/** The SWR key of the shareVideoProject mutation. */
export const MUTATE_SHARE_VIDEO_PROJECT_SWR_KEY = "MUTATE_SHARE_VIDEO_PROJECT_SWR"

/** SWR mutation for {@link mutateShareVideoProject}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateShareVideoProjectSwr = () =>
    useSWRMutation(
        MUTATE_SHARE_VIDEO_PROJECT_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateShareVideoProject({ request: arg }), MUTATE_SHARE_VIDEO_PROJECT_SWR_KEY)
                .shareVideoProject,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: Parameters<typeof MutateShareVideoProjectOperation>[0]["request"]
}
