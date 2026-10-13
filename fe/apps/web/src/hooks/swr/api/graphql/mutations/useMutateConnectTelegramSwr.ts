import useSWRMutation from "swr/mutation"
import { mutateConnectTelegram } from "@/modules/api/graphql/mutations/mutation-connect-telegram"
import type { MutateConnectTelegramRequest } from "@/modules/api/graphql/mutations/mutation-connect-telegram"

/** What the connectTelegram mutation is triggered with. */
interface ConnectTelegramArg {
    readonly arg: MutateConnectTelegramRequest
}

/** The SWR key of the connectTelegram mutation. */
export const MUTATE_CONNECT_TELEGRAM_SWR_KEY = "MUTATE_CONNECT_TELEGRAM_SWR"

/** SWR mutation for {@link mutateConnectTelegram}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateConnectTelegramSwr = () =>
    useSWRMutation(MUTATE_CONNECT_TELEGRAM_SWR_KEY, async (_key: string, { arg }: ConnectTelegramArg) => {
        const result = await mutateConnectTelegram({ request: arg })
        if (result.data === undefined || result.data === null) throw new Error("connectTelegram answered no data")
        return result.data.connectTelegram
    })
