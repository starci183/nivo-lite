import { mutateSaveContentBrand } from "@/modules/api/graphql/mutations/mutation-save-content-brand"
import { useGraphQLMutationSwr } from "@/hooks/reuseables"

/** The SWR key of the saveContentBrand mutation. */
export const MUTATE_SAVE_CONTENT_BRAND_SWR_KEY = "MUTATE_SAVE_CONTENT_BRAND_SWR"

/** SWR mutation for {@link mutateSaveContentBrand}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateSaveContentBrandSwr = () =>
    useGraphQLMutationSwr(MUTATE_SAVE_CONTENT_BRAND_SWR_KEY, mutateSaveContentBrand, (data) => data.saveContentBrand)
