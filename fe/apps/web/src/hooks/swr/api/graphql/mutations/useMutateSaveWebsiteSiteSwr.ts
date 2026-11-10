"use client"

import useSWRMutation from "swr/mutation"
import { useSWRConfig } from "swr"
import { matchesSwrKey } from "@/modules/utils"
import { QUERY_WEBSITE_SITE_SWR_KEY } from "../queries/useQueryWebsiteSiteSwr"
import {
    mutateSaveWebsiteSite,
    type mutateSaveWebsiteSite as SaveWebsiteSiteOperation,
} from "@/modules/api/graphql/mutations/mutation-save-website-site"
import type { SWRMutationResponse } from "swr/mutation"
import type { SaveWebsiteSiteMutation } from "@/modules/api"

/** The request of the SaveWebsiteSite operation. */
type SaveWebsiteSiteArg = Parameters<typeof SaveWebsiteSiteOperation>[0]["request"]

/** What the SaveWebsiteSite mutation is triggered with. */
interface TriggerArg {
    readonly arg: SaveWebsiteSiteArg
}

/** The SWR identity of the SaveWebsiteSite mutation. */
export const MUTATE_SAVE_WEBSITE_SITE_SWR_KEY = "MUTATE_SAVE_WEBSITE_SITE_SWR"

/** Changes the website intake; the drawer reads the saved switches back. */
export const useMutateSaveWebsiteSiteSwr = (
    workspaceId: string,
): SWRMutationResponse<
    SaveWebsiteSiteMutation["saveWebsiteSite"] | undefined,
    Error,
    [string, string],
    SaveWebsiteSiteArg
> => {
    const { mutate } = useSWRConfig()
    return useSWRMutation(
        [MUTATE_SAVE_WEBSITE_SITE_SWR_KEY, workspaceId],
        ([, scope]: [string, string], { arg }: TriggerArg) =>
            mutateSaveWebsiteSite({ request: arg, headers: { "X-Workspace-Id": scope } }).then(
                (result) => result.data?.saveWebsiteSite,
            ),
        {
            onSuccess: () => {
                void mutate(matchesSwrKey(QUERY_WEBSITE_SITE_SWR_KEY))
            },
        },
    )
}
