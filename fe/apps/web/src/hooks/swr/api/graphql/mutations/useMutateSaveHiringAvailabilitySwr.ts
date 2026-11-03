"use client"

import useSWRMutation from "swr/mutation"
import { mutateSaveHiringAvailability } from "@/modules/api/graphql/mutations/mutation-save-hiring-availability"
import type { MutateSaveHiringAvailabilityRequest } from "@/modules/api/graphql/mutations/mutation-save-hiring-availability"
import type { SWRMutationResponse } from "swr/mutation"
import type { OperationData } from "@/hooks/workspaceread"

/** What the saveHiringAvailability mutation is triggered with. */
interface SaveHiringAvailabilityArg {
    readonly arg: MutateSaveHiringAvailabilityRequest
}

/** The SWR key of the `saveHiringAvailability` mutation. */
export const MUTATE_SAVE_HIRING_AVAILABILITY_SWR_KEY = "MUTATE_SAVE_HIRING_AVAILABILITY_SWR"

/** SWR mutation for {@link mutateSaveHiringAvailability}: `trigger(request)` answers `saveHiringAvailability` and rejects with the back end failure. */
export const useMutateSaveHiringAvailabilitySwr = (): SWRMutationResponse<
    OperationData<typeof mutateSaveHiringAvailability>["saveHiringAvailability"],
    Error,
    typeof MUTATE_SAVE_HIRING_AVAILABILITY_SWR_KEY,
    SaveHiringAvailabilityArg["arg"]
> =>
    useSWRMutation(
        MUTATE_SAVE_HIRING_AVAILABILITY_SWR_KEY,
        async (_key: string, { arg }: SaveHiringAvailabilityArg) => {
            const result = await mutateSaveHiringAvailability({ request: arg })
            if (!result.data) throw new Error("saveHiringAvailability answered no data")
            return result.data.saveHiringAvailability
        },
    )
