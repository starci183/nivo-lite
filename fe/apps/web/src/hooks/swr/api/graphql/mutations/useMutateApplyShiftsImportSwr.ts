import useSWRMutation from "swr/mutation"
import { mutateApplyShiftsImport } from "@/modules/api/graphql/mutations/mutation-apply-shifts-import"
import type { MutateApplyShiftsImportRequest } from "@/modules/api/graphql/mutations/mutation-apply-shifts-import"

/** What the applyShiftsImport mutation is triggered with. */
interface ApplyShiftsImportArg {
    readonly arg: MutateApplyShiftsImportRequest
}

/** The SWR key of the `applyShiftsImport` mutation. */
export const MUTATE_APPLY_SHIFTS_IMPORT_SWR_KEY = "MUTATE_APPLY_SHIFTS_IMPORT_SWR"

/** SWR mutation for {@link mutateApplyShiftsImport}: `trigger(request)` answers `applyShiftsImport` and rejects with the back end failure. */
export const useMutateApplyShiftsImportSwr = () =>
    useSWRMutation(MUTATE_APPLY_SHIFTS_IMPORT_SWR_KEY, async (_key: string, { arg }: ApplyShiftsImportArg) => {
        const result = await mutateApplyShiftsImport({ request: arg })
        if (!result.data) throw new Error("applyShiftsImport answered no data")
        return result.data.applyShiftsImport
    })
