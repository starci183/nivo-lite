"use client"

import { mutateSaveContentBrand } from "@/modules/api/graphql/mutations/mutation-save-content-brand"
import type { mutateSaveContentBrand as MutateSaveContentBrandOperation } from "@/modules/api/graphql/mutations/mutation-save-content-brand"
import useSWRMutation from "swr/mutation"
import { answeredData } from "@/hooks/workspaceread"

/** The SWR key of the saveContentBrand mutation. */
export const MUTATE_SAVE_CONTENT_BRAND_SWR_KEY = "MUTATE_SAVE_CONTENT_BRAND_SWR"

/** SWR mutation for {@link mutateSaveContentBrand}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateSaveContentBrandSwr = () =>
    useSWRMutation(
        MUTATE_SAVE_CONTENT_BRAND_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateSaveContentBrand({ request: arg }), MUTATE_SAVE_CONTENT_BRAND_SWR_KEY)
                .saveContentBrand,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: Parameters<typeof MutateSaveContentBrandOperation>[0]["request"]
}
