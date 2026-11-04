"use client"

import useSWRMutation from "swr/mutation"
import type { SWRMutationResponse } from "swr/mutation"
import type { InstallTemplateListingMutation } from "@/modules/api"
import {
    mutateInstallTemplateListing,
    type MutateInstallTemplateListingRequest,
} from "@/modules/api/graphql/mutations/mutation-install-template-listing"

/** The SWR key of the `installTemplateListing` mutation. */
export const MUTATE_INSTALL_TEMPLATE_LISTING_SWR_KEY = "MUTATE_INSTALL_TEMPLATE_LISTING_SWR"

/** The argument the trigger of this hook is called with. */
interface TriggerArg {
    readonly arg: MutateInstallTemplateListingRequest
}

/** The back end `installTemplateListing` mutation. */
export const useMutateInstallTemplateListingSwr = (): SWRMutationResponse<
    InstallTemplateListingMutation["installTemplateListing"],
    Error,
    string,
    MutateInstallTemplateListingRequest
> =>
    useSWRMutation(MUTATE_INSTALL_TEMPLATE_LISTING_SWR_KEY, async (_key: string, { arg }: TriggerArg) => {
        const result = await mutateInstallTemplateListing({ request: arg })
        if (!result.data) throw new Error("installTemplateListing answered no data")
        return result.data.installTemplateListing
    })
