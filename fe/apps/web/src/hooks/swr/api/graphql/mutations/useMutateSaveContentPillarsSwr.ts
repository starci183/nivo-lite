import { mutateSaveContentPillars } from "@/modules/api/graphql/mutations/mutation-save-content-pillars"
import { useGraphQLMutationSwr } from "@/hooks/reuseables/useGraphQLMutationSwr"

/** The SWR key of the saveContentPillars mutation. */
export const MUTATE_SAVE_CONTENT_PILLARS_SWR_KEY = "MUTATE_SAVE_CONTENT_PILLARS_SWR"

/** SWR mutation for {@link mutateSaveContentPillars}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateSaveContentPillarsSwr = () =>
    useGraphQLMutationSwr(
        MUTATE_SAVE_CONTENT_PILLARS_SWR_KEY,
        mutateSaveContentPillars,
        (data) => data.saveContentPillars,
    )
