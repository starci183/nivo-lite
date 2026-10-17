"use client"

import { mutateSaveContentCadence } from "@/modules/api/graphql/mutations/mutation-save-content-cadence"
import type { mutateSaveContentCadence as MutateSaveContentCadenceOperation } from "@/modules/api/graphql/mutations/mutation-save-content-cadence"
import useSWRMutation from "swr/mutation"
import { answeredData } from "@/hooks/workspaceread"

/** The SWR key of the saveContentCadence mutation. */
export const MUTATE_SAVE_CONTENT_CADENCE_SWR_KEY = "MUTATE_SAVE_CONTENT_CADENCE_SWR"

/** SWR mutation for {@link mutateSaveContentCadence}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateSaveContentCadenceSwr = () =>
    useSWRMutation(
        MUTATE_SAVE_CONTENT_CADENCE_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateSaveContentCadence({ request: arg }), MUTATE_SAVE_CONTENT_CADENCE_SWR_KEY)
                .saveContentCadence,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: Parameters<typeof MutateSaveContentCadenceOperation>[0]["request"]
}
