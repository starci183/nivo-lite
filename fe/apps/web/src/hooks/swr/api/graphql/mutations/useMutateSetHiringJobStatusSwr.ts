import useSWRMutation from "swr/mutation"
import { mutateSetHiringJobStatus } from "@/modules/api/graphql/mutations/mutation-set-hiring-job-status"
import type { MutateSetHiringJobStatusRequest } from "@/modules/api/graphql/mutations/mutation-set-hiring-job-status"

/** What the setHiringJobStatus mutation is triggered with. */
interface SetHiringJobStatusArg {
    readonly arg: MutateSetHiringJobStatusRequest
}

/** The SWR key of the `setHiringJobStatus` mutation. */
export const MUTATE_SET_HIRING_JOB_STATUS_SWR_KEY = "MUTATE_SET_HIRING_JOB_STATUS_SWR"

/** SWR mutation for {@link mutateSetHiringJobStatus}: `trigger(request)` answers `setHiringJobStatus` and rejects with the back end failure. */
export const useMutateSetHiringJobStatusSwr = () =>
    useSWRMutation(MUTATE_SET_HIRING_JOB_STATUS_SWR_KEY, async (_key: string, { arg }: SetHiringJobStatusArg) => {
        const result = await mutateSetHiringJobStatus({ request: arg })
        if (!result.data) throw new Error("setHiringJobStatus answered no data")
        return result.data.setHiringJobStatus
    })
