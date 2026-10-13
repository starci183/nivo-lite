import { mutateSaveVideoBrand } from "@/modules/api/graphql/mutations/mutation-save-video-brand"
import { useGraphQLMutationSwr } from "@/hooks/reuseables"

/** The SWR key of the saveVideoBrand mutation. */
export const MUTATE_SAVE_VIDEO_BRAND_SWR_KEY = "MUTATE_SAVE_VIDEO_BRAND_SWR"

/** SWR mutation for {@link mutateSaveVideoBrand}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateSaveVideoBrandSwr = () =>
    useGraphQLMutationSwr(MUTATE_SAVE_VIDEO_BRAND_SWR_KEY, mutateSaveVideoBrand, (data) => data.saveVideoBrand)
