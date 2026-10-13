import { useGraphQLMutationSwr } from "@/hooks/reuseables"
import { mutateStartTelegramLogin } from "@/modules/api/graphql/mutations/mutation-start-telegram-login"

/** The SWR key of the startTelegramLogin mutation. */
export const MUTATE_START_TELEGRAM_LOGIN_SWR_KEY = "MUTATE_START_TELEGRAM_LOGIN_SWR"

/** SWR mutation for {@link mutateStartTelegramLogin}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateStartTelegramLoginSwr = () =>
    useGraphQLMutationSwr(
        MUTATE_START_TELEGRAM_LOGIN_SWR_KEY,
        mutateStartTelegramLogin,
        (data) => data.startTelegramLogin,
    )
