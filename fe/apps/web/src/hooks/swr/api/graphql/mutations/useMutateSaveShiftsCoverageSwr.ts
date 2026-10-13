import useSWRMutation from "swr/mutation"
import { mutateSaveShiftsCoverage } from "@/modules/api/graphql/mutations/mutation-save-shifts-coverage"
import type { MutateSaveShiftsCoverageRequest } from "@/modules/api/graphql/mutations/mutation-save-shifts-coverage"

/** What the saveShiftsCoverage mutation is triggered with. */
interface SaveShiftsCoverageArg {
    readonly arg: MutateSaveShiftsCoverageRequest
}

/** The SWR key of the `saveShiftsCoverage` mutation. */
export const MUTATE_SAVE_SHIFTS_COVERAGE_SWR_KEY = "MUTATE_SAVE_SHIFTS_COVERAGE_SWR"

/** SWR mutation for {@link mutateSaveShiftsCoverage}: `trigger(request)` answers `saveShiftsCoverage` and rejects with the back end failure. */
export const useMutateSaveShiftsCoverageSwr = () =>
    useSWRMutation(MUTATE_SAVE_SHIFTS_COVERAGE_SWR_KEY, async (_key: string, { arg }: SaveShiftsCoverageArg) => {
        const result = await mutateSaveShiftsCoverage({ request: arg })
        if (!result.data) throw new Error("saveShiftsCoverage answered no data")
        return result.data.saveShiftsCoverage
    })
