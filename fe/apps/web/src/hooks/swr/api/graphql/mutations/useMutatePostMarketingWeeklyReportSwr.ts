"use client"

import { mutatePostMarketingWeeklyReport } from "@/modules/api/graphql/mutations/mutation-post-marketing-weekly-report"
import { answeredData } from "@/hooks/workspaceread"
import useSWRMutation from "swr/mutation"
import type { SWRMutationResponse } from "swr/mutation"
import type { PostMarketingWeeklyReportMutation } from "@/modules/api"

/** The SWR key of the postMarketingWeeklyReport mutation. */
export const MUTATE_POST_MARKETING_WEEKLY_REPORT_SWR_KEY = "MUTATE_POST_MARKETING_WEEKLY_REPORT_SWR"

/** SWR mutation for {@link mutatePostMarketingWeeklyReport}: posts the last week's report into the Marketing room (no input). */
export const useMutatePostMarketingWeeklyReportSwr = (): SWRMutationResponse<
    PostMarketingWeeklyReportMutation["postMarketingWeeklyReport"],
    Error,
    typeof MUTATE_POST_MARKETING_WEEKLY_REPORT_SWR_KEY,
    never
> =>
    useSWRMutation(
        MUTATE_POST_MARKETING_WEEKLY_REPORT_SWR_KEY,
        async (_key: string) =>
            answeredData(await mutatePostMarketingWeeklyReport(), MUTATE_POST_MARKETING_WEEKLY_REPORT_SWR_KEY)
                .postMarketingWeeklyReport,
    )
