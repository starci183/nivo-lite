"use client"

import {
    mutateArchiveVideoProject,
    type mutateArchiveVideoProject as MutateArchiveVideoProjectOperation,
} from "@/modules/api/graphql/mutations/mutation-archive-video-project"
import { answeredData } from "@/hooks/workspaceread"
import useSWRMutation from "swr/mutation"
import type { SWRMutationResponse } from "swr/mutation"
import type { ArchiveVideoProjectMutation } from "@/modules/api"

/** The SWR key of the archiveVideoProject mutation. */
export const MUTATE_ARCHIVE_VIDEO_PROJECT_SWR_KEY = "MUTATE_ARCHIVE_VIDEO_PROJECT_SWR"

/** SWR mutation for {@link mutateArchiveVideoProject}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateArchiveVideoProjectSwr = (): SWRMutationResponse<
    ArchiveVideoProjectMutation["archiveVideoProject"],
    Error,
    typeof MUTATE_ARCHIVE_VIDEO_PROJECT_SWR_KEY,
    TriggerArg["arg"]
> =>
    useSWRMutation(
        MUTATE_ARCHIVE_VIDEO_PROJECT_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateArchiveVideoProject({ request: arg }), MUTATE_ARCHIVE_VIDEO_PROJECT_SWR_KEY)
                .archiveVideoProject,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: Parameters<typeof MutateArchiveVideoProjectOperation>[0]["request"]
}
