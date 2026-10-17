"use client"

import { mutateSaveVideoBrand } from "@/modules/api/graphql/mutations/mutation-save-video-brand"
import type { mutateSaveVideoBrand as MutateSaveVideoBrandOperation } from "@/modules/api/graphql/mutations/mutation-save-video-brand"
import useSWRMutation from "swr/mutation"
import { answeredData } from "@/hooks/workspaceread"

/** The SWR key of the saveVideoBrand mutation. */
export const MUTATE_SAVE_VIDEO_BRAND_SWR_KEY = "MUTATE_SAVE_VIDEO_BRAND_SWR"

/** SWR mutation for {@link mutateSaveVideoBrand}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateSaveVideoBrandSwr = () =>
    useSWRMutation(
        MUTATE_SAVE_VIDEO_BRAND_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateSaveVideoBrand({ request: arg }), MUTATE_SAVE_VIDEO_BRAND_SWR_KEY).saveVideoBrand,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: Parameters<typeof MutateSaveVideoBrandOperation>[0]["request"]
}
