import useSWRMutation from "swr/mutation"
import { mutateApplyToHiringJob } from "@/modules/api/graphql/mutations/mutation-apply-to-hiring-job"
import type { MutateApplyToHiringJobRequest } from "@/modules/api/graphql/mutations/mutation-apply-to-hiring-job"

/** What the applyToHiringJob mutation is triggered with. */
interface ApplyToHiringJobArg {
    readonly arg: MutateApplyToHiringJobRequest
}

/** The SWR key of the `applyToHiringJob` mutation. */
export const MUTATE_APPLY_TO_HIRING_JOB_SWR_KEY = "MUTATE_APPLY_TO_HIRING_JOB_SWR"

/** SWR mutation for {@link mutateApplyToHiringJob}: `trigger(request)` answers `applyToHiringJob` and rejects with the back end failure. */
export const useMutateApplyToHiringJobSwr = () =>
    useSWRMutation(MUTATE_APPLY_TO_HIRING_JOB_SWR_KEY, async (_key: string, { arg }: ApplyToHiringJobArg) => {
        const result = await mutateApplyToHiringJob({ request: arg })
        if (!result.data) throw new Error("applyToHiringJob answered no data")
        return result.data.applyToHiringJob
    })
