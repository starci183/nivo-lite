"use client"

import useSWRMutation from "swr/mutation"
import type { SWRMutationResponse } from "swr/mutation"
import type { ImportAgentTemplateData } from "@/modules/api/graphql"
import { mutateImportAgentTemplate } from "@/modules/api/graphql/mutations/mutation-import-agent-template"
import type { MutateImportAgentTemplateRequest } from "@/modules/api/graphql/mutations/mutation-import-agent-template"

/** The SWR key of the `importAgentTemplate` mutation. */
export const MUTATE_IMPORT_AGENT_TEMPLATE_SWR_KEY = "MUTATE_IMPORT_AGENT_TEMPLATE_SWR"

/** The argument the trigger of this hook is called with. */
interface TriggerArg {
    readonly arg: MutateImportAgentTemplateRequest
}

/** The back end `importAgentTemplate` mutation. */
export const useMutateImportAgentTemplateSwr = (): SWRMutationResponse<
    ImportAgentTemplateData,
    Error,
    string,
    MutateImportAgentTemplateRequest
> =>
    useSWRMutation(MUTATE_IMPORT_AGENT_TEMPLATE_SWR_KEY, async (_key: string, { arg }: TriggerArg) => {
        const result = await mutateImportAgentTemplate({ request: arg })
        if (!result.data) throw new Error("importAgentTemplate answered no data")
        return result.data.importAgentTemplate
    })
