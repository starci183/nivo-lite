import useSWRMutation from "swr/mutation"
import { mutateSaveTelegramUserSetup } from "@/modules/api/graphql/mutations/mutation-save-telegram-user-setup"
import type { MutateSaveTelegramUserSetupRequest } from "@/modules/api/graphql/mutations/mutation-save-telegram-user-setup"

/** What the saveTelegramUserSetup mutation is triggered with. */
interface SaveTelegramUserSetupArg {
    readonly arg: MutateSaveTelegramUserSetupRequest
}

/** The SWR key of the saveTelegramUserSetup mutation. */
export const MUTATE_SAVE_TELEGRAM_USER_SETUP_SWR_KEY = "MUTATE_SAVE_TELEGRAM_USER_SETUP_SWR"

/** SWR mutation for {@link mutateSaveTelegramUserSetup}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateSaveTelegramUserSetupSwr = () =>
    useSWRMutation(MUTATE_SAVE_TELEGRAM_USER_SETUP_SWR_KEY, async (_key: string, { arg }: SaveTelegramUserSetupArg) => {
        const result = await mutateSaveTelegramUserSetup({ request: arg })
        if (result.data === undefined || result.data === null) throw new Error("saveTelegramUserSetup answered no data")
        return result.data.saveTelegramUserSetup
    })
