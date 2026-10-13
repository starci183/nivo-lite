import useSWRMutation from "swr/mutation"
import { mutateCancelTelegramLogin } from "@/modules/api/graphql/mutations/mutation-cancel-telegram-login"
import type { MutateCancelTelegramLoginRequest } from "@/modules/api/graphql/mutations/mutation-cancel-telegram-login"

/** What the cancelTelegramLogin mutation is triggered with. */
interface CancelTelegramLoginArg {
    readonly arg: MutateCancelTelegramLoginRequest
}

/** The SWR key of the cancelTelegramLogin mutation. */
export const MUTATE_CANCEL_TELEGRAM_LOGIN_SWR_KEY = "MUTATE_CANCEL_TELEGRAM_LOGIN_SWR"

/** SWR mutation for {@link mutateCancelTelegramLogin}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateCancelTelegramLoginSwr = () =>
    useSWRMutation(MUTATE_CANCEL_TELEGRAM_LOGIN_SWR_KEY, async (_key: string, { arg }: CancelTelegramLoginArg) => {
        const result = await mutateCancelTelegramLogin({ request: arg })
        if (result.data === undefined || result.data === null) throw new Error("cancelTelegramLogin answered no data")
        return result.data.cancelTelegramLogin
    })
