"use client"

import { mutateArchiveVideoProject } from "@/modules/api/graphql/mutations/mutation-archive-video-project"
import type { mutateArchiveVideoProject as MutateArchiveVideoProjectOperation } from "@/modules/api/graphql/mutations/mutation-archive-video-project"
import { answeredData } from "@/hooks/workspaceread"
import useSWRMutation from "swr/mutation"

/** The SWR key of the archiveVideoProject mutation. */
export const MUTATE_ARCHIVE_VIDEO_PROJECT_SWR_KEY = "MUTATE_ARCHIVE_VIDEO_PROJECT_SWR"

/** SWR mutation for {@link mutateArchiveVideoProject}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateArchiveVideoProjectSwr = () =>
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
