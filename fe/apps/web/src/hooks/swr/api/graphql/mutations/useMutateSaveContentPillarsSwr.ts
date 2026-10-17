"use client"

import { mutateSaveContentPillars } from "@/modules/api/graphql/mutations/mutation-save-content-pillars"
import type { mutateSaveContentPillars as MutateSaveContentPillarsOperation } from "@/modules/api/graphql/mutations/mutation-save-content-pillars"
import useSWRMutation from "swr/mutation"
import { answeredData } from "@/hooks/workspaceread"

/** The SWR key of the saveContentPillars mutation. */
export const MUTATE_SAVE_CONTENT_PILLARS_SWR_KEY = "MUTATE_SAVE_CONTENT_PILLARS_SWR"

/** SWR mutation for {@link mutateSaveContentPillars}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateSaveContentPillarsSwr = () =>
    useSWRMutation(
        MUTATE_SAVE_CONTENT_PILLARS_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateSaveContentPillars({ request: arg }), MUTATE_SAVE_CONTENT_PILLARS_SWR_KEY)
                .saveContentPillars,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: Parameters<typeof MutateSaveContentPillarsOperation>[0]["request"]
}
