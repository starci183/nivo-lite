import useSWR from "swr"
import { queryAutomationGoogleAccounts } from "@/modules/api/graphql/queries/query-automation-google-accounts"
import { googleAccountViewOf } from "@/modules/automations"

/** The SWR key of the Google accounts of the workspace. */
export const QUERY_AUTOMATION_GOOGLE_ACCOUNTS_SWR_KEY = "QUERY_AUTOMATION_GOOGLE_ACCOUNTS_SWR"

/** The Google accounts of the active workspace a spreadsheet automation can write with (the back end `automationGoogleAccounts` query). */
export const useQueryAutomationGoogleAccountsSwr = () =>
    useSWR(QUERY_AUTOMATION_GOOGLE_ACCOUNTS_SWR_KEY, async ({ signal }: { signal?: AbortSignal } = {}) => {
        const result = await queryAutomationGoogleAccounts({ signal })
        if (!result.data) throw new Error("automationGoogleAccounts answered no data")
        return result.data.automationGoogleAccounts.map(googleAccountViewOf)
    })
