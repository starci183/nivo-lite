"use client"

import useSWR from "swr"
import { workspaceArgumentKey, type ReadResponse, type WorkspaceReadKey } from "@/hooks/workspaceread"
import { queryInboxLead } from "@/modules/api/graphql/queries/query-inbox-lead"
import type { InboxLeadQuery } from "@/modules/api"

/** The identity of the opened customer cache. */
export const QUERY_INBOX_LEAD_SWR_KEY = "QUERY_INBOX_LEAD_SWR"

/** Reads one opened customer while the page is visible; no id (nothing opened) reads nothing. */
export const useQueryInboxLeadSwr = (
    workspaceId: string | undefined,
    id: string | null,
): ReadResponse<InboxLeadQuery["inboxLead"]> =>
    useSWR(
        workspaceArgumentKey(QUERY_INBOX_LEAD_SWR_KEY, workspaceId, id ?? undefined),
        async ([, scope, leadId]: WorkspaceReadKey<string>) => {
            const result = await queryInboxLead({ request: { id: leadId }, headers: { "X-Workspace-Id": scope } })
            if (!result.data) throw new Error("inboxLead answered no data")
            return result.data.inboxLead
        },
        { refreshInterval: 5000 },
    )
