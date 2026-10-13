import { useGraphQLMutationSwr } from "@/hooks/reuseables"
import { mutateCancelTelegramLogin } from "@/modules/api/graphql/mutations/mutation-cancel-telegram-login"

/** The SWR key of the cancelTelegramLogin mutation. */
export const MUTATE_CANCEL_TELEGRAM_LOGIN_SWR_KEY = "MUTATE_CANCEL_TELEGRAM_LOGIN_SWR"

/** SWR mutation for {@link mutateCancelTelegramLogin}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateCancelTelegramLoginSwr = () =>
    useGraphQLMutationSwr(
        MUTATE_CANCEL_TELEGRAM_LOGIN_SWR_KEY,
        mutateCancelTelegramLogin,
        (data) => data.cancelTelegramLogin,
    )
