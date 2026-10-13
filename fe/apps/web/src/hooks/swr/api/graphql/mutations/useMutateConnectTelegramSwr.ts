import { useGraphQLMutationSwr } from "@/hooks/reuseables"
import { mutateConnectTelegram } from "@/modules/api/graphql/mutations/mutation-connect-telegram"

/** The SWR key of the connectTelegram mutation. */
export const MUTATE_CONNECT_TELEGRAM_SWR_KEY = "MUTATE_CONNECT_TELEGRAM_SWR"

/** SWR mutation for {@link mutateConnectTelegram}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateConnectTelegramSwr = () =>
    useGraphQLMutationSwr(MUTATE_CONNECT_TELEGRAM_SWR_KEY, mutateConnectTelegram, (data) => data.connectTelegram)
