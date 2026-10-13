import useSWRMutation from "swr/mutation"
import { mutateChooseMetaPage } from "@/modules/api/graphql/mutations/mutation-choose-meta-page"
import type { MutateChooseMetaPageRequest } from "@/modules/api/graphql/mutations/mutation-choose-meta-page"

/** What the chooseMetaPage mutation is triggered with. */
interface ChooseMetaPageArg {
    readonly arg: MutateChooseMetaPageRequest
}

/** The SWR key of the chooseMetaPage mutation. */
export const MUTATE_CHOOSE_META_PAGE_SWR_KEY = "MUTATE_CHOOSE_META_PAGE_SWR"

/** SWR mutation for {@link mutateChooseMetaPage}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateChooseMetaPageSwr = () =>
    useSWRMutation(MUTATE_CHOOSE_META_PAGE_SWR_KEY, async (_key: string, { arg }: ChooseMetaPageArg) => {
        const result = await mutateChooseMetaPage({ request: arg })
        if (result.data === undefined || result.data === null) throw new Error("chooseMetaPage answered no data")
        return result.data.chooseMetaPage
    })
