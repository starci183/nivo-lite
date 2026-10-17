"use client"

import { mutateConnectTelegram } from "@/modules/api/graphql/mutations/mutation-connect-telegram"
import type { mutateConnectTelegram as MutateConnectTelegramOperation } from "@/modules/api/graphql/mutations/mutation-connect-telegram"
import { answeredData } from "@/hooks/workspaceread"
import useSWRMutation from "swr/mutation"

/** The SWR key of the connectTelegram mutation. */
export const MUTATE_CONNECT_TELEGRAM_SWR_KEY = "MUTATE_CONNECT_TELEGRAM_SWR"

/** SWR mutation for {@link mutateConnectTelegram}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateConnectTelegramSwr = () =>
    useSWRMutation(
        MUTATE_CONNECT_TELEGRAM_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateConnectTelegram({ request: arg }), MUTATE_CONNECT_TELEGRAM_SWR_KEY)
                .connectTelegram,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: Parameters<typeof MutateConnectTelegramOperation>[0]["request"]
}
