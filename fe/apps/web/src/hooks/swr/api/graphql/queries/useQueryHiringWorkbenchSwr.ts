import useSWR from "swr"
import { queryHiringWorkbench } from "@/modules/api/graphql/queries/query-hiring-workbench"

/** The SWR key of the `hiringWorkbench` query. */
export const QUERY_HIRING_WORKBENCH_SWR_KEY = "QUERY_HIRING_WORKBENCH_SWR"

/** The `hiringWorkbench` query through SWR. */
export const useQueryHiringWorkbenchSwr = () =>
    useSWR(QUERY_HIRING_WORKBENCH_SWR_KEY, async () => {
        const result = await queryHiringWorkbench()
        if (!result.data) throw new Error("hiringWorkbench answered no data")
        return result.data.hiringWorkbench
    })
