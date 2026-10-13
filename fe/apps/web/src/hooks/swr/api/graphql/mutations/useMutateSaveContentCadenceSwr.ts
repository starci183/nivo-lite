import { mutateSaveContentCadence } from "@/modules/api/graphql/mutations/mutation-save-content-cadence"
import { useGraphQLMutationSwr } from "@/hooks/reuseables"

/** The SWR key of the saveContentCadence mutation. */
export const MUTATE_SAVE_CONTENT_CADENCE_SWR_KEY = "MUTATE_SAVE_CONTENT_CADENCE_SWR"

/** SWR mutation for {@link mutateSaveContentCadence}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateSaveContentCadenceSwr = () =>
    useGraphQLMutationSwr(
        MUTATE_SAVE_CONTENT_CADENCE_SWR_KEY,
        mutateSaveContentCadence,
        (data) => data.saveContentCadence,
    )
