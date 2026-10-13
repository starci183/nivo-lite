import { noData, useWorkspaceArgSwr } from "@/hooks/workspaceread"
import { queryLeadJourney } from "@/modules/api/graphql/queries/query-lead-journey"

/** Workspace-scoped cache identity for the leadJourney query. */
export const QUERY_LEAD_JOURNEY_SWR_KEY = "QUERY_LEAD_JOURNEY_SWR"

/** Reads leadJourney. The workspace id is part of the cache identity; `undefined` pauses the read. */
export const useQueryLeadJourneySwr = (workspaceId: string | undefined, leadId: string | undefined) =>
    useWorkspaceArgSwr(
        QUERY_LEAD_JOURNEY_SWR_KEY,
        workspaceId,
        leadId,
        async (value) =>
            (await queryLeadJourney({ request: { leadId: value } })).data?.leadJourney ?? noData("leadJourney"),
    )
