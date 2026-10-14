"use client"

import useSWR from "swr"
import { queryMyAccount } from "@/modules/api/graphql/queries/query-my-account"

/** The SWR key of the myAccount query; mutations that change it call `mutate` with it. */
export const QUERY_MY_ACCOUNT_SWR_KEY = "QUERY_MY_ACCOUNT_SWR"

/** The signed-in account: profile, linked sign-in methods and device sessions. */
export const useQueryMyAccountSwr = () =>
    useSWR(QUERY_MY_ACCOUNT_SWR_KEY, async () => {
        const result = await queryMyAccount()
        if (!result.data) throw new Error("myAccount answered no data")
        return result.data.myAccount
    })
