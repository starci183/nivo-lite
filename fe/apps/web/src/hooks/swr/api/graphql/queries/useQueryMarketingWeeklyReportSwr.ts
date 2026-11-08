"use client"

import { answeredData, type WorkspaceReadKey } from "@/hooks/workspaceread"
import { useWorkspaceParamsKey } from "@/hooks/workspaceKey"
import useSWR, { type SWRResponse } from "swr"
import { queryMarketingWeeklyReport } from "@/modules/api/graphql/queries/query-marketing-weekly-report"
import type { MarketingWeeklyReportQuery } from "@/modules/api"

/** The SWR key of the marketingWeeklyReport query. */
export const QUERY_MARKETING_WEEKLY_REPORT_SWR_KEY = "QUERY_MARKETING_WEEKLY_REPORT_SWR"

/** The weekly marketing report; an empty week start reads the last complete week. */
export const useQueryMarketingWeeklyReportSwr = (
    weekStart: string,
): SWRResponse<MarketingWeeklyReportQuery["marketingWeeklyReport"], Error> =>
    useSWR(
        useWorkspaceParamsKey(QUERY_MARKETING_WEEKLY_REPORT_SWR_KEY, [weekStart] as const),
        async ([, , ...input]: WorkspaceReadKey<string>) =>
            answeredData(
                await queryMarketingWeeklyReport({ request: { weekStart: input[0] } }),
                QUERY_MARKETING_WEEKLY_REPORT_SWR_KEY,
            ).marketingWeeklyReport,
    )
