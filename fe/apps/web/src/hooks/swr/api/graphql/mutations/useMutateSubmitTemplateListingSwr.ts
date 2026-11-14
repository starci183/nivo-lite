"use client"

import useSWRMutation, { type SWRMutationResponse } from "swr/mutation"
import type { SubmitTemplateListingMutation } from "@/modules/api"
import {
    mutateSubmitTemplateListing,
    type MutateSubmitTemplateListingRequest,
} from "@/modules/api/graphql/mutations/mutation-submit-template-listing"

/** The SWR key of the `submitTemplateListing` mutation. */
export const MUTATE_SUBMIT_TEMPLATE_LISTING_SWR_KEY = "MUTATE_SUBMIT_TEMPLATE_LISTING_SWR"

/** The argument the trigger of this hook is called with. */
interface TriggerArg {
    readonly arg: MutateSubmitTemplateListingRequest
}

/** The back end `submitTemplateListing` mutation. */
export const useMutateSubmitTemplateListingSwr = (): SWRMutationResponse<
    SubmitTemplateListingMutation["submitTemplateListing"],
    Error,
    string,
    MutateSubmitTemplateListingRequest
> =>
    useSWRMutation(MUTATE_SUBMIT_TEMPLATE_LISTING_SWR_KEY, async (_key: string, { arg }: TriggerArg) => {
        const result = await mutateSubmitTemplateListing({ request: arg })
        if (!result.data) throw new Error("submitTemplateListing answered no data")
        return result.data.submitTemplateListing
    })
