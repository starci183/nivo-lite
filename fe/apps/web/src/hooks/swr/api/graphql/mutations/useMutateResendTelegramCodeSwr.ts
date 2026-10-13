import { useGraphQLMutationSwr } from "@/hooks/reuseables"
import { mutateResendTelegramCode } from "@/modules/api/graphql/mutations/mutation-resend-telegram-code"

/** The SWR key of the resendTelegramCode mutation. */
export const MUTATE_RESEND_TELEGRAM_CODE_SWR_KEY = "MUTATE_RESEND_TELEGRAM_CODE_SWR"

/** SWR mutation for {@link mutateResendTelegramCode}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateResendTelegramCodeSwr = () =>
    useGraphQLMutationSwr(
        MUTATE_RESEND_TELEGRAM_CODE_SWR_KEY,
        mutateResendTelegramCode,
        (data) => data.resendTelegramCode,
    )
