"use client"

import { mutateSaveZaloOaSecret } from "@/modules/api/graphql/mutations/mutation-save-zalo-oa-secret"
import type { mutateSaveZaloOaSecret as MutateSaveZaloOaSecretOperation } from "@/modules/api/graphql/mutations/mutation-save-zalo-oa-secret"
import useSWRMutation from "swr/mutation"
import { answeredData } from "@/hooks/workspaceread"

/** The SWR key of the saveZaloOaSecret mutation. */
export const MUTATE_SAVE_ZALO_OA_SECRET_SWR_KEY = "MUTATE_SAVE_ZALO_OA_SECRET_SWR"

/** SWR mutation for {@link mutateSaveZaloOaSecret}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateSaveZaloOaSecretSwr = () =>
    useSWRMutation(
        MUTATE_SAVE_ZALO_OA_SECRET_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateSaveZaloOaSecret({ request: arg }), MUTATE_SAVE_ZALO_OA_SECRET_SWR_KEY)
                .saveZaloOaSecret,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: Parameters<typeof MutateSaveZaloOaSecretOperation>[0]["request"]
}
