"use client"

import { argumentKey } from "@/hooks/workspaceread"
import useSWR from "swr"
import type { SWRResponse } from "swr"
import { queryPromoChatbotState } from "@/modules/api/graphql/queries/query-promo-chatbot-state"
import type { PromoChatbotStateQuery } from "@/modules/api"

/** The SWR key of the promoChatbotState query. */
export const QUERY_PROMO_CHATBOT_STATE_SWR_KEY = "QUERY_PROMO_CHATBOT_STATE_SWR"

/** The chatbot promo facts of the workspace; idle until a workspace is selected. */
export const useQueryPromoChatbotStateSwr = (
    workspaceId: string | undefined,
): SWRResponse<PromoChatbotStateQuery["promoChatbotState"], Error> =>
    useSWR(argumentKey(QUERY_PROMO_CHATBOT_STATE_SWR_KEY, workspaceId), async () => {
        const result = await queryPromoChatbotState()
        if (!result.data) throw new Error("promoChatbotState answered no data")
        return result.data.promoChatbotState
    })
