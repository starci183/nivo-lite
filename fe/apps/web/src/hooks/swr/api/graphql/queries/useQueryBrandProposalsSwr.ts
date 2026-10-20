"use client"

import { answeredData } from "@/hooks/workspaceread"
import type { WorkspaceReadKey } from "@/hooks/workspaceread"
import { useWorkspaceParamsKey } from "@/hooks/workspaceKey"
import useSWR from "swr"
import { queryBrandProposals } from "@/modules/api/graphql/queries/query-brand-proposals"

/** The SWR key of the brandProposals query. */
export const QUERY_BRAND_PROPOSALS_SWR_KEY = "QUERY_BRAND_PROPOSALS_SWR"

/** The brand kits read from guideline PDFs of one agent instance (no read without an instance). */
export const useQueryBrandProposalsSwr = (installationId: string | null) =>
    useSWR(
        useWorkspaceParamsKey(
            QUERY_BRAND_PROPOSALS_SWR_KEY,
            installationId === null ? null : ([installationId] as const),
        ),
        async ([, , ...input]: WorkspaceReadKey<string>) =>
            answeredData(
                await queryBrandProposals({ request: { installationId: input[0] } }),
                QUERY_BRAND_PROPOSALS_SWR_KEY,
            ).brandProposals,
    )
