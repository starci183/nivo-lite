"use client"

import useSWR from "swr"
import type { SWRConfiguration } from "swr"
import { useWorkspaceKey } from "@/hooks/workspaceKey"
import { queryOfficeConversationUnread } from "@/modules/api/graphql/queries/query-office-conversation-unread"
import type { ReadResponse } from "@/hooks/workspaceread"
import type { OfficeConversationUnreadQuery } from "@/modules/api"

/** The SWR key of {@link useQueryOfficeConversationUnreadSwr}. */
export const QUERY_OFFICE_CONVERSATION_UNREAD_SWR_KEY = "QUERY_OFFICE_CONVERSATION_UNREAD_SWR"

/** The back end `officeConversationUnread` query. */
export const useQueryOfficeConversationUnreadSwr = (
    config?: SWRConfiguration,
): ReadResponse<OfficeConversationUnreadQuery["officeConversationUnread"] | undefined> =>
    useSWR(
        useWorkspaceKey(QUERY_OFFICE_CONVERSATION_UNREAD_SWR_KEY, []),
        async () => (await queryOfficeConversationUnread()).data?.officeConversationUnread,
        config,
    )
