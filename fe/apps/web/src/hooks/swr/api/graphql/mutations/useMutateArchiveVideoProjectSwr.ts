import { mutateArchiveVideoProject } from "@/modules/api/graphql/mutations/mutation-archive-video-project"
import { useGraphQLMutationSwr } from "@/hooks/reuseables"

/** The SWR key of the archiveVideoProject mutation. */
export const MUTATE_ARCHIVE_VIDEO_PROJECT_SWR_KEY = "MUTATE_ARCHIVE_VIDEO_PROJECT_SWR"

/** SWR mutation for {@link mutateArchiveVideoProject}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateArchiveVideoProjectSwr = () =>
    useGraphQLMutationSwr(
        MUTATE_ARCHIVE_VIDEO_PROJECT_SWR_KEY,
        mutateArchiveVideoProject,
        (data) => data.archiveVideoProject,
    )
