"use client"

import useSWR from "swr"
import { useWorkspaceKey } from "@/hooks/workspaceKey"
import { queryCrmTemplates } from "@/modules/api/graphql/queries/query-crm-templates"
import { answeredData, type ReadResponse } from "@/hooks/workspaceread"
import type { CrmTemplatesQuery } from "@/modules/api"

/** The SWR key of the crmTemplates query. */
export const QUERY_CRM_TEMPLATES_SWR_KEY = "QUERY_CRM_TEMPLATES_SWR"

/** The CRMs the installed packages declare, each with its name in both languages. */
export const useQueryCrmTemplatesSwr = (): ReadResponse<CrmTemplatesQuery["crmTemplates"]> =>
    useSWR(
        useWorkspaceKey(QUERY_CRM_TEMPLATES_SWR_KEY, []),
        async ({ signal }: { signal?: AbortSignal } = {}) =>
            answeredData(await queryCrmTemplates({ signal }), "crmTemplates").crmTemplates,
    )
