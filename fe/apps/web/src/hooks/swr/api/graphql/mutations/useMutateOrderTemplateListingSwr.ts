"use client"

import useSWRMutation from "swr/mutation"
import { mutateOrderTemplateListing } from "@/modules/api/graphql/mutations/mutation-order-template-listing"
import type { MutateOrderTemplateListingRequest } from "@/modules/api/graphql/mutations/mutation-order-template-listing"

/** The SWR key of the `orderTemplateListing` mutation. */
export const MUTATE_ORDER_TEMPLATE_LISTING_SWR_KEY = "MUTATE_ORDER_TEMPLATE_LISTING_SWR"

/** The argument the trigger of this hook is called with. */
interface TriggerArg {
    readonly arg: MutateOrderTemplateListingRequest
}

/** The back end `orderTemplateListing` mutation. */
export const useMutateOrderTemplateListingSwr = () =>
    useSWRMutation(MUTATE_ORDER_TEMPLATE_LISTING_SWR_KEY, async (_key: string, { arg }: TriggerArg) => {
        const result = await mutateOrderTemplateListing({ request: arg })
        if (!result.data) throw new Error("orderTemplateListing answered no data")
        return result.data.orderTemplateListing
    })
