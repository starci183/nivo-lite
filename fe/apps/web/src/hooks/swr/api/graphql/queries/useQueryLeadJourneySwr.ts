"use client"

import { readRequiredField, workspaceArgumentKey } from "@/hooks/workspaceread"
import type { WorkspaceReadKey } from "@/hooks/workspaceread"
import useSWR from "swr"
import { queryLeadJourney } from "@/modules/api/graphql/queries/query-lead-journey"

/** Workspace-scoped cache identity for the leadJourney query. */
export const QUERY_LEAD_JOURNEY_SWR_KEY = "QUERY_LEAD_JOURNEY_SWR"

/** Reads leadJourney. The workspace id is part of the cache identity; `undefined` pauses the read. */
export const useQueryLeadJourneySwr = (workspaceId: string | undefined, leadId: string | undefined) =>
    useSWR(
        workspaceArgumentKey(QUERY_LEAD_JOURNEY_SWR_KEY, workspaceId, leadId),
        ([, , leadId]: WorkspaceReadKey<string>) => readRequiredField(queryLeadJourney, { leadId }, "leadJourney"),
    )
