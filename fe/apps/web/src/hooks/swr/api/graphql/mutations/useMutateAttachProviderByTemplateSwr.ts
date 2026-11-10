"use client"

import { mutateAttachProviderByTemplate, type MutateAttachProviderByTemplateRequest } from "@/modules/api/graphql/mutations/mutation-attach-provider-by-template"
import { answeredData } from "@/hooks/workspaceread"
import useSWRMutation, { type SWRMutationResponse } from "swr/mutation"

/** The SWR key of the attachProviderByTemplate mutation. */
export const MUTATE_ATTACH_PROVIDER_BY_TEMPLATE_SWR_KEY = "MUTATE_ATTACH_PROVIDER_BY_TEMPLATE_SWR"

/** SWR mutation for {@link mutateAttachProviderByTemplate}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateAttachProviderByTemplateSwr = (): SWRMutationResponse<string[], Error, typeof MUTATE_ATTACH_PROVIDER_BY_TEMPLATE_SWR_KEY, MutateAttachProviderByTemplateRequest> =>
    useSWRMutation(
        MUTATE_ATTACH_PROVIDER_BY_TEMPLATE_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateAttachProviderByTemplate({ request: arg }), MUTATE_ATTACH_PROVIDER_BY_TEMPLATE_SWR_KEY).attachProviderByTemplate,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: MutateAttachProviderByTemplateRequest
}
