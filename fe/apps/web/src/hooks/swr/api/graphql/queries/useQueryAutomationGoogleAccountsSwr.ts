"use client"

import useSWR from "swr"
import { useWorkspaceKey } from "@/hooks/workspaceKey"
import { queryAutomationGoogleAccounts } from "@/modules/api/graphql/queries/query-automation-google-accounts"
import { googleAccountViewOf } from "@/modules/automations"
import type { ReadResponse } from "@/hooks/workspaceread"

/** The SWR key of the Google accounts of the workspace. */
export const QUERY_AUTOMATION_GOOGLE_ACCOUNTS_SWR_KEY = "QUERY_AUTOMATION_GOOGLE_ACCOUNTS_SWR"

/** The Google accounts of the active workspace a spreadsheet automation can write with (the back end `automationGoogleAccounts` query). */
export const useQueryAutomationGoogleAccountsSwr = (): ReadResponse<ReturnType<typeof googleAccountViewOf>[]> => {
    const key = useWorkspaceKey(QUERY_AUTOMATION_GOOGLE_ACCOUNTS_SWR_KEY, [])
    return useSWR(key, async () => {
        const result = await queryAutomationGoogleAccounts()
        if (!result.data) throw new Error("automationGoogleAccounts answered no data")
        return result.data.automationGoogleAccounts.map(googleAccountViewOf)
    })
}
