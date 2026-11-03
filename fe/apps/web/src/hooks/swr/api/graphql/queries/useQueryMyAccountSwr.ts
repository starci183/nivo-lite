"use client"

import useSWR from "swr"
import { useViewerKey } from "@/hooks/workspaceKey"
import { queryMyAccount } from "@/modules/api/graphql/queries/query-my-account"
import type { OperationData, ReadResponse } from "@/hooks/workspaceread"

/** The SWR key of the myAccount query; mutations that change it call `mutate` with it. */
export const QUERY_MY_ACCOUNT_SWR_KEY = "QUERY_MY_ACCOUNT_SWR"

/** The signed-in account: profile, linked sign-in methods and device sessions. */
export const useQueryMyAccountSwr = (): ReadResponse<OperationData<typeof queryMyAccount>["myAccount"]> =>
    useSWR(useViewerKey(QUERY_MY_ACCOUNT_SWR_KEY), async () => {
        const result = await queryMyAccount()
        if (!result.data) throw new Error("myAccount answered no data")
        return result.data.myAccount
    })
