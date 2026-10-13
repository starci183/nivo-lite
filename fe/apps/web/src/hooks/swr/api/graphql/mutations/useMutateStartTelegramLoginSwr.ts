import useSWRMutation from "swr/mutation"
import { mutateStartTelegramLogin } from "@/modules/api/graphql/mutations/mutation-start-telegram-login"
import type { MutateStartTelegramLoginRequest } from "@/modules/api/graphql/mutations/mutation-start-telegram-login"

/** What the startTelegramLogin mutation is triggered with. */
interface StartTelegramLoginArg {
    readonly arg: MutateStartTelegramLoginRequest
}

/** The SWR key of the startTelegramLogin mutation. */
export const MUTATE_START_TELEGRAM_LOGIN_SWR_KEY = "MUTATE_START_TELEGRAM_LOGIN_SWR"

/** SWR mutation for {@link mutateStartTelegramLogin}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateStartTelegramLoginSwr = () =>
    useSWRMutation(MUTATE_START_TELEGRAM_LOGIN_SWR_KEY, async (_key: string, { arg }: StartTelegramLoginArg) => {
        const result = await mutateStartTelegramLogin({ request: arg })
        if (result.data === undefined || result.data === null) throw new Error("startTelegramLogin answered no data")
        return result.data.startTelegramLogin
    })
