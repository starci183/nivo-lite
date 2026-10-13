import { useGraphQLMutationSwr } from "@/hooks/reuseables"
import { mutateSaveTelegramUserSetup } from "@/modules/api/graphql/mutations/mutation-save-telegram-user-setup"

/** The SWR key of the saveTelegramUserSetup mutation. */
export const MUTATE_SAVE_TELEGRAM_USER_SETUP_SWR_KEY = "MUTATE_SAVE_TELEGRAM_USER_SETUP_SWR"

/** SWR mutation for {@link mutateSaveTelegramUserSetup}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateSaveTelegramUserSetupSwr = () =>
    useGraphQLMutationSwr(
        MUTATE_SAVE_TELEGRAM_USER_SETUP_SWR_KEY,
        mutateSaveTelegramUserSetup,
        (data) => data.saveTelegramUserSetup,
    )
