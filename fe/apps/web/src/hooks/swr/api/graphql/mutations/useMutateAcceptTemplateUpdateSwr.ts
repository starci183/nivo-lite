"use client"

import useSWRMutation from "swr/mutation"
import { mutateAcceptTemplateUpdate } from "@/modules/api/graphql/mutations/mutation-accept-template-update"
import type { MutateAcceptTemplateUpdateRequest } from "@/modules/api/graphql/mutations/mutation-accept-template-update"

/** The SWR key of the `acceptTemplateUpdate` mutation. */
export const MUTATE_ACCEPT_TEMPLATE_UPDATE_SWR_KEY = "MUTATE_ACCEPT_TEMPLATE_UPDATE_SWR"

/** The argument the trigger of this hook is called with. */
interface TriggerArg {
    readonly arg: MutateAcceptTemplateUpdateRequest
}

/** The back end `acceptTemplateUpdate` mutation. */
export const useMutateAcceptTemplateUpdateSwr = () =>
    useSWRMutation(MUTATE_ACCEPT_TEMPLATE_UPDATE_SWR_KEY, async (_key: string, { arg }: TriggerArg) => {
        const result = await mutateAcceptTemplateUpdate({ request: arg })
        if (!result.data) throw new Error("acceptTemplateUpdate answered no data")
        return result.data.acceptTemplateUpdate
    })
