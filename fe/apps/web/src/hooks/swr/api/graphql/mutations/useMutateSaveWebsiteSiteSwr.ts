"use client"

import { mutateSaveWebsiteSite, type MutateSaveWebsiteSiteRequest } from "@/modules/api/graphql/mutations/mutation-save-website-site"
import { answeredData } from "@/hooks/workspaceread"
import type { SaveWebsiteSiteMutation } from "@/modules/api"
import useSWRMutation, { type SWRMutationResponse } from "swr/mutation"

/** The SWR key of the saveWebsiteSite mutation. */
export const MUTATE_SAVE_WEBSITE_SITE_SWR_KEY = "MUTATE_SAVE_WEBSITE_SITE_SWR"

/** The website intake after the change. */
type Site = SaveWebsiteSiteMutation["saveWebsiteSite"]

/** SWR mutation for {@link mutateSaveWebsiteSite}: `trigger(input)` answers the saved intake and rejects with the back end failure. */
export const useMutateSaveWebsiteSiteSwr = (): SWRMutationResponse<Site, Error, typeof MUTATE_SAVE_WEBSITE_SITE_SWR_KEY, MutateSaveWebsiteSiteRequest> =>
    useSWRMutation(
        MUTATE_SAVE_WEBSITE_SITE_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateSaveWebsiteSite({ request: arg }), MUTATE_SAVE_WEBSITE_SITE_SWR_KEY).saveWebsiteSite,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: MutateSaveWebsiteSiteRequest
}
