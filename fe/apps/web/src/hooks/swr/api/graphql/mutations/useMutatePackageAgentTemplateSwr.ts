"use client"

import useSWRMutation from "swr/mutation"
import { mutatePackageAgentTemplate } from "@/modules/api/graphql/mutations/mutation-package-agent-template"
import type { MutatePackageAgentTemplateRequest } from "@/modules/api/graphql/mutations/mutation-package-agent-template"

/** The SWR key of the `packageAgentTemplate` mutation. */
export const MUTATE_PACKAGE_AGENT_TEMPLATE_SWR_KEY = "MUTATE_PACKAGE_AGENT_TEMPLATE_SWR"

/** The argument the trigger of this hook is called with. */
interface TriggerArg {
    readonly arg: MutatePackageAgentTemplateRequest
}

/** The back end `packageAgentTemplate` mutation. */
export const useMutatePackageAgentTemplateSwr = () =>
    useSWRMutation(MUTATE_PACKAGE_AGENT_TEMPLATE_SWR_KEY, async (_key: string, { arg }: TriggerArg) => {
        const result = await mutatePackageAgentTemplate({ request: arg })
        if (!result.data) throw new Error("packageAgentTemplate answered no data")
        return result.data.packageAgentTemplate
    })
