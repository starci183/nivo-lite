import useSWRMutation from "swr/mutation"
import { mutateProposeShiftsWeek } from "@/modules/api/graphql/mutations/mutation-propose-shifts-week"
import type { MutateProposeShiftsWeekRequest } from "@/modules/api/graphql/mutations/mutation-propose-shifts-week"

/** What the proposeShiftsWeek mutation is triggered with. */
interface ProposeShiftsWeekArg {
    readonly arg: MutateProposeShiftsWeekRequest
}

/** The SWR key of the `proposeShiftsWeek` mutation. */
export const MUTATE_PROPOSE_SHIFTS_WEEK_SWR_KEY = "MUTATE_PROPOSE_SHIFTS_WEEK_SWR"

/** SWR mutation for {@link mutateProposeShiftsWeek}: `trigger(request)` answers `proposeShiftsWeek` and rejects with the back end failure. */
export const useMutateProposeShiftsWeekSwr = () =>
    useSWRMutation(MUTATE_PROPOSE_SHIFTS_WEEK_SWR_KEY, async (_key: string, { arg }: ProposeShiftsWeekArg) => {
        const result = await mutateProposeShiftsWeek({ request: arg })
        if (!result.data) throw new Error("proposeShiftsWeek answered no data")
        return result.data.proposeShiftsWeek
    })
