import { useGraphQLMutationSwr } from "@/hooks/reuseables"
import { mutateChooseMetaPage } from "@/modules/api/graphql/mutations/mutation-choose-meta-page"

/** The SWR key of the chooseMetaPage mutation. */
export const MUTATE_CHOOSE_META_PAGE_SWR_KEY = "MUTATE_CHOOSE_META_PAGE_SWR"

/** SWR mutation for {@link mutateChooseMetaPage}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateChooseMetaPageSwr = () =>
    useGraphQLMutationSwr(MUTATE_CHOOSE_META_PAGE_SWR_KEY, mutateChooseMetaPage, (data) => data.chooseMetaPage)
