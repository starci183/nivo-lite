"use client"

import { mutatePostMarketingWeeklyReport } from "@/modules/api/graphql/mutations/mutation-post-marketing-weekly-report"
import { answeredData } from "@/hooks/workspaceread"
import useSWRMutation from "swr/mutation"

/** The SWR key of the postMarketingWeeklyReport mutation. */
export const MUTATE_POST_MARKETING_WEEKLY_REPORT_SWR_KEY = "MUTATE_POST_MARKETING_WEEKLY_REPORT_SWR"

/** SWR mutation for {@link mutatePostMarketingWeeklyReport}: posts the last week's report into the Marketing room (no input). */
export const useMutatePostMarketingWeeklyReportSwr = () =>
    useSWRMutation(
        MUTATE_POST_MARKETING_WEEKLY_REPORT_SWR_KEY,
        async (_key: string) =>
            answeredData(await mutatePostMarketingWeeklyReport(), MUTATE_POST_MARKETING_WEEKLY_REPORT_SWR_KEY)
                .postMarketingWeeklyReport,
    )
