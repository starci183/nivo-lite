"use client"

import {
    mutateChooseMetaPage,
    type mutateChooseMetaPage as MutateChooseMetaPageOperation,
} from "@/modules/api/graphql/mutations/mutation-choose-meta-page"
import { answeredData } from "@/hooks/workspaceread"
import useSWRMutation, { type SWRMutationResponse } from "swr/mutation"
import type { ChooseMetaPageMutation } from "@/modules/api"

/** The SWR key of the chooseMetaPage mutation. */
export const MUTATE_CHOOSE_META_PAGE_SWR_KEY = "MUTATE_CHOOSE_META_PAGE_SWR"

/** SWR mutation for {@link mutateChooseMetaPage}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateChooseMetaPageSwr = (): SWRMutationResponse<
    ChooseMetaPageMutation["chooseMetaPage"],
    Error,
    typeof MUTATE_CHOOSE_META_PAGE_SWR_KEY,
    TriggerArg["arg"]
> =>
    useSWRMutation(
        MUTATE_CHOOSE_META_PAGE_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateChooseMetaPage({ request: arg }), MUTATE_CHOOSE_META_PAGE_SWR_KEY).chooseMetaPage,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: Parameters<typeof MutateChooseMetaPageOperation>[0]["request"]
}
