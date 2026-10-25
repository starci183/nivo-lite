"use client"

import useSWR from "swr"
import type { SWRConfiguration } from "swr"
import { useWorkspaceKey } from "@/hooks/workspaceKey"
import { queryModuleRequirementFacts } from "@/modules/api/graphql/queries/query-module-requirement-facts"

/** The SWR key of {@link useQueryModuleRequirementFactsSwr}. */
export const QUERY_MODULE_REQUIREMENT_FACTS_SWR_KEY = "QUERY_MODULE_REQUIREMENT_FACTS_SWR"

/** The back end `moduleRequirementFacts` query. */
export const useQueryModuleRequirementFactsSwr = (config?: SWRConfiguration) =>
    useSWR(
        useWorkspaceKey(QUERY_MODULE_REQUIREMENT_FACTS_SWR_KEY, []),
        async () => (await queryModuleRequirementFacts()).data?.moduleRequirementFacts,
        config,
    )
