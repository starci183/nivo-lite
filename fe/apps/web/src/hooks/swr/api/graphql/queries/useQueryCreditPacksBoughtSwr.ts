import useSWR from "swr"
import { queryCreditPacksBought } from "@/modules/api/graphql/queries/query-credit-packs-bought"

/** Cache identity of creditPacksBought within a workspace. */
export const QUERY_CREDIT_PACKS_BOUGHT_SWR_KEY = "QUERY_CREDIT_PACKS_BOUGHT_SWR"

/** Reads the add-on packs bought this month for the selected workspace. */
export const useQueryCreditPacksBoughtSwr = (workspaceId: string | undefined) =>
    useSWR(workspaceId === undefined ? null : [QUERY_CREDIT_PACKS_BOUGHT_SWR_KEY, workspaceId], async () => {
        const result = await queryCreditPacksBought()
        if (!result.data) throw new Error("creditPacksBought answered no data")
        return result.data.creditPacksBought
    })
