import { useGraphQLMutationSwr } from "@/hooks/reuseables"
import { mutateSubmitTelegramCode } from "@/modules/api/graphql/mutations/mutation-submit-telegram-code"

/** The SWR key of the submitTelegramCode mutation. */
export const MUTATE_SUBMIT_TELEGRAM_CODE_SWR_KEY = "MUTATE_SUBMIT_TELEGRAM_CODE_SWR"

/** SWR mutation for {@link mutateSubmitTelegramCode}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateSubmitTelegramCodeSwr = () =>
    useGraphQLMutationSwr(
        MUTATE_SUBMIT_TELEGRAM_CODE_SWR_KEY,
        mutateSubmitTelegramCode,
        (data) => data.submitTelegramCode,
    )
