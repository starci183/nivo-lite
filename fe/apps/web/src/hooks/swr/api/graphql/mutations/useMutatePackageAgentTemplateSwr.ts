"use client"

import useSWRMutation, { type SWRMutationResponse } from "swr/mutation"
import type { PackageAgentTemplateMutation } from "@/modules/api"
import {
    mutatePackageAgentTemplate,
    type MutatePackageAgentTemplateRequest,
} from "@/modules/api/graphql/mutations/mutation-package-agent-template"

/** The SWR key of the `packageAgentTemplate` mutation. */
export const MUTATE_PACKAGE_AGENT_TEMPLATE_SWR_KEY = "MUTATE_PACKAGE_AGENT_TEMPLATE_SWR"

/** The argument the trigger of this hook is called with. */
interface TriggerArg {
    readonly arg: MutatePackageAgentTemplateRequest
}

/** The back end `packageAgentTemplate` mutation. */
export const useMutatePackageAgentTemplateSwr = (): SWRMutationResponse<
    PackageAgentTemplateMutation["packageAgentTemplate"],
    Error,
    string,
    MutatePackageAgentTemplateRequest
> =>
    useSWRMutation(MUTATE_PACKAGE_AGENT_TEMPLATE_SWR_KEY, async (_key: string, { arg }: TriggerArg) => {
        const result = await mutatePackageAgentTemplate({ request: arg })
        if (!result.data) throw new Error("packageAgentTemplate answered no data")
        return result.data.packageAgentTemplate
    })
