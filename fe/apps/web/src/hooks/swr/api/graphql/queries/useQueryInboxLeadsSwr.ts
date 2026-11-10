"use client"

import useSWR from "swr"
import { workspaceArgumentKey, type ReadResponse, type WorkspaceReadKey } from "@/hooks/workspaceread"
import { queryInboxLeads } from "@/modules/api/graphql/queries/query-inbox-leads"
import type { InboxLeadsQuery } from "@/modules/api"

/** The identity of the lead list cache. */
export const QUERY_INBOX_LEADS_SWR_KEY = "QUERY_INBOX_LEADS_SWR"

/** The tab, the filters and the order the lead list is read with. */
export type InboxLeadsRequest = NonNullable<NonNullable<Parameters<typeof queryInboxLeads>[0]>["request"]>

/** Reads the customers of the inbox for one tab while the page is visible, so a customer who just wrote shows up without a reload. */
export const useQueryInboxLeadsSwr = (
    workspaceId: string | undefined,
    request: InboxLeadsRequest,
): ReadResponse<InboxLeadsQuery["inboxLeads"]> =>
    useSWR(
        workspaceArgumentKey(QUERY_INBOX_LEADS_SWR_KEY, workspaceId, request),
        async ([, scope, input]: WorkspaceReadKey<InboxLeadsRequest>) => {
            const result = await queryInboxLeads({ request: input, headers: { "X-Workspace-Id": scope } })
            if (!result.data) throw new Error("inboxLeads answered no data")
            return result.data.inboxLeads
        },
        { refreshInterval: 5000, keepPreviousData: true },
    )
