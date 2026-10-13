import useSWRMutation from "swr/mutation"
import { mutateSaveZaloOaSecret } from "@/modules/api/graphql/mutations/mutation-save-zalo-oa-secret"
import type { MutateSaveZaloOaSecretRequest } from "@/modules/api/graphql/mutations/mutation-save-zalo-oa-secret"

/** What the saveZaloOaSecret mutation is triggered with. */
interface SaveZaloOaSecretArg {
    readonly arg: MutateSaveZaloOaSecretRequest
}

/** The SWR key of the saveZaloOaSecret mutation. */
export const MUTATE_SAVE_ZALO_OA_SECRET_SWR_KEY = "MUTATE_SAVE_ZALO_OA_SECRET_SWR"

/** SWR mutation for {@link mutateSaveZaloOaSecret}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateSaveZaloOaSecretSwr = () =>
    useSWRMutation(MUTATE_SAVE_ZALO_OA_SECRET_SWR_KEY, async (_key: string, { arg }: SaveZaloOaSecretArg) => {
        const result = await mutateSaveZaloOaSecret({ request: arg })
        if (result.data === undefined || result.data === null) throw new Error("saveZaloOaSecret answered no data")
        return result.data.saveZaloOaSecret
    })
