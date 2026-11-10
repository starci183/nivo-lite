"use client"

import useSWRMutation from "swr/mutation"
import {
    mutateSaveWorkingHours,
    type MutateSaveWorkingHoursRequest,
} from "@/modules/api/graphql/mutations/mutation-save-working-hours"
import type { SWRMutationResponse } from "swr/mutation"
import type { SaveWorkingHoursMutation } from "@/modules/api"

/** What the SaveWorkingHours mutation is triggered with. */
interface SaveWorkingHoursArg {
    readonly arg: MutateSaveWorkingHoursRequest
}

/** The SWR key of {@link useMutateSaveWorkingHoursSwr}. */
export const MUTATE_SAVE_WORKING_HOURS_SWR_KEY = "MUTATE_SAVE_WORKING_HOURS_SWR"

/** SWR mutation for {@link mutateSaveWorkingHours}: `trigger(request)` answers the payload and rejects with the back end failure. */
export const useMutateSaveWorkingHoursSwr = (): SWRMutationResponse<
    SaveWorkingHoursMutation["saveWorkingHours"],
    Error,
    typeof MUTATE_SAVE_WORKING_HOURS_SWR_KEY,
    SaveWorkingHoursArg["arg"]
> =>
    useSWRMutation(MUTATE_SAVE_WORKING_HOURS_SWR_KEY, async (_key: string, { arg }: SaveWorkingHoursArg) => {
        const result = await mutateSaveWorkingHours({ request: arg })
        if (!result.data) throw new Error("saveWorkingHours answered no data")
        return result.data.saveWorkingHours
    })
