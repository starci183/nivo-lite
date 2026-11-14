"use client"

import useSWRMutation, { type SWRMutationResponse } from "swr/mutation"
import {
    mutateSubmitWebsiteLead,
    type mutateSubmitWebsiteLead as SubmitWebsiteLeadOperation,
} from "@/modules/api/graphql/mutations/mutation-submit-website-lead"
import type { SubmitWebsiteLeadMutation } from "@/modules/api"

/** The request of the SubmitWebsiteLead operation. */
type SubmitWebsiteLeadArg = Parameters<typeof SubmitWebsiteLeadOperation>[0]["request"]

/** What the SubmitWebsiteLead mutation is triggered with. */
interface TriggerArg {
    readonly arg: SubmitWebsiteLeadArg
}

/** The SWR identity of the SubmitWebsiteLead mutation. */
export const MUTATE_SUBMIT_WEBSITE_LEAD_SWR_KEY = "MUTATE_SUBMIT_WEBSITE_LEAD_SWR"

/** Sends the form of an anonymous visitor of the hosted page; no sign-in, no workspace header. */
export const useMutateSubmitWebsiteLeadSwr = (): SWRMutationResponse<
    SubmitWebsiteLeadMutation["submitWebsiteLead"],
    Error,
    typeof MUTATE_SUBMIT_WEBSITE_LEAD_SWR_KEY,
    SubmitWebsiteLeadArg
> =>
    useSWRMutation(MUTATE_SUBMIT_WEBSITE_LEAD_SWR_KEY, async (_key: string, { arg }: TriggerArg) => {
        const result = await mutateSubmitWebsiteLead({ request: arg })
        if (!result.data) throw new Error("submitWebsiteLead answered no data")
        return result.data.submitWebsiteLead
    })
