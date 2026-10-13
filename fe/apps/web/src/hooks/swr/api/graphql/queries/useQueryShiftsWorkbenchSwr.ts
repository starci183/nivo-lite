import { useKeyedQuerySwr } from "@/hooks/reuseables"
import { queryShiftsWorkbench } from "@/modules/api/graphql/queries/query-shifts-workbench"
import type { QueryShiftsWorkbenchRequest } from "@/modules/api/graphql/queries/query-shifts-workbench"

/** The SWR key of the `shiftsWorkbench` query. */
export const QUERY_SHIFTS_WORKBENCH_SWR_KEY = "QUERY_SHIFTS_WORKBENCH_SWR"

/** The `shiftsWorkbench` query through SWR; `undefined` suspends the read. */
export const useQueryShiftsWorkbenchSwr = (request: QueryShiftsWorkbenchRequest | undefined) =>
    useKeyedQuerySwr(
        QUERY_SHIFTS_WORKBENCH_SWR_KEY,
        request,
        (input) => queryShiftsWorkbench({ request: input }),
        (data) => data.shiftsWorkbench,
    )
