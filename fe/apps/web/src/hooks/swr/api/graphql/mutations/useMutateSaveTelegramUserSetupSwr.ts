"use client"

import { mutateSaveTelegramUserSetup } from "@/modules/api/graphql/mutations/mutation-save-telegram-user-setup"
import type { mutateSaveTelegramUserSetup as MutateSaveTelegramUserSetupOperation } from "@/modules/api/graphql/mutations/mutation-save-telegram-user-setup"
import useSWRMutation from "swr/mutation"
import { answeredData } from "@/hooks/workspaceread"

/** The SWR key of the saveTelegramUserSetup mutation. */
export const MUTATE_SAVE_TELEGRAM_USER_SETUP_SWR_KEY = "MUTATE_SAVE_TELEGRAM_USER_SETUP_SWR"

/** SWR mutation for {@link mutateSaveTelegramUserSetup}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateSaveTelegramUserSetupSwr = () =>
    useSWRMutation(
        MUTATE_SAVE_TELEGRAM_USER_SETUP_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateSaveTelegramUserSetup({ request: arg }), MUTATE_SAVE_TELEGRAM_USER_SETUP_SWR_KEY)
                .saveTelegramUserSetup,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: Parameters<typeof MutateSaveTelegramUserSetupOperation>[0]["request"]
}
