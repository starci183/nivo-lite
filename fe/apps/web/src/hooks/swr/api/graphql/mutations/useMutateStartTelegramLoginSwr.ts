"use client"

import { mutateStartTelegramLogin } from "@/modules/api/graphql/mutations/mutation-start-telegram-login"
import type { mutateStartTelegramLogin as MutateStartTelegramLoginOperation } from "@/modules/api/graphql/mutations/mutation-start-telegram-login"
import useSWRMutation from "swr/mutation"
import { answeredData } from "@/hooks/workspaceread"

/** The SWR key of the startTelegramLogin mutation. */
export const MUTATE_START_TELEGRAM_LOGIN_SWR_KEY = "MUTATE_START_TELEGRAM_LOGIN_SWR"

/** SWR mutation for {@link mutateStartTelegramLogin}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateStartTelegramLoginSwr = () =>
    useSWRMutation(
        MUTATE_START_TELEGRAM_LOGIN_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateStartTelegramLogin({ request: arg }), MUTATE_START_TELEGRAM_LOGIN_SWR_KEY)
                .startTelegramLogin,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: Parameters<typeof MutateStartTelegramLoginOperation>[0]["request"]
}
