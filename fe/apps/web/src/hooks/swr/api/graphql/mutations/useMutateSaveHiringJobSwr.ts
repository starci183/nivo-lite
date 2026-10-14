"use client"

import useSWRMutation from "swr/mutation"
import { mutateSaveHiringJob } from "@/modules/api/graphql/mutations/mutation-save-hiring-job"
import type { MutateSaveHiringJobRequest } from "@/modules/api/graphql/mutations/mutation-save-hiring-job"

/** What the saveHiringJob mutation is triggered with. */
interface SaveHiringJobArg {
    readonly arg: MutateSaveHiringJobRequest
}

/** The SWR key of the `saveHiringJob` mutation. */
export const MUTATE_SAVE_HIRING_JOB_SWR_KEY = "MUTATE_SAVE_HIRING_JOB_SWR"

/** SWR mutation for {@link mutateSaveHiringJob}: `trigger(request)` answers `saveHiringJob` and rejects with the back end failure. */
export const useMutateSaveHiringJobSwr = () =>
    useSWRMutation(MUTATE_SAVE_HIRING_JOB_SWR_KEY, async (_key: string, { arg }: SaveHiringJobArg) => {
        const result = await mutateSaveHiringJob({ request: arg })
        if (!result.data) throw new Error("saveHiringJob answered no data")
        return result.data.saveHiringJob
    })
