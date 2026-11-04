"use client"

import useSWRMutation from "swr/mutation"
import {
    mutateRemoveShiftsCoverage,
    type MutateRemoveShiftsCoverageRequest,
} from "@/modules/api/graphql/mutations/mutation-remove-shifts-coverage"
import type { SWRMutationResponse } from "swr/mutation"
import type { RemoveShiftsCoverageMutation } from "@/modules/api"

/** What the removeShiftsCoverage mutation is triggered with. */
interface RemoveShiftsCoverageArg {
    readonly arg: MutateRemoveShiftsCoverageRequest
}

/** The SWR key of the `removeShiftsCoverage` mutation. */
export const MUTATE_REMOVE_SHIFTS_COVERAGE_SWR_KEY = "MUTATE_REMOVE_SHIFTS_COVERAGE_SWR"

/** SWR mutation for {@link mutateRemoveShiftsCoverage}: `trigger(request)` answers `removeShiftsCoverage` and rejects with the back end failure. */
export const useMutateRemoveShiftsCoverageSwr = (): SWRMutationResponse<
    RemoveShiftsCoverageMutation["removeShiftsCoverage"],
    Error,
    typeof MUTATE_REMOVE_SHIFTS_COVERAGE_SWR_KEY,
    RemoveShiftsCoverageArg["arg"]
> =>
    useSWRMutation(MUTATE_REMOVE_SHIFTS_COVERAGE_SWR_KEY, async (_key: string, { arg }: RemoveShiftsCoverageArg) => {
        const result = await mutateRemoveShiftsCoverage({ request: arg })
        if (!result.data) throw new Error("removeShiftsCoverage answered no data")
        return result.data.removeShiftsCoverage
    })
