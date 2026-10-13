import useSWR from "swr"
import { queryAccountingWorkbench } from "@/modules/api/graphql/queries/query-accounting-workbench"
import { accountingWorkbenchOf } from "@/modules/utils"

/** Cache identity of the accounting workbench. */
export const QUERY_ACCOUNTING_WORKBENCH_SWR_KEY = "QUERY_ACCOUNTING_WORKBENCH_SWR"

/** Loads the complete accounting workbench for the active workspace. */
export const useQueryAccountingWorkbenchSwr = (workspaceId: string | undefined) => {
    return useSWR(workspaceId ? [QUERY_ACCOUNTING_WORKBENCH_SWR_KEY, workspaceId] : null, async () => {
        const result = await queryAccountingWorkbench({})
        if (!result.data) throw new Error("accountingWorkbench answered no data")
        return accountingWorkbenchOf(result.data.accountingWorkbench)
    })
}
