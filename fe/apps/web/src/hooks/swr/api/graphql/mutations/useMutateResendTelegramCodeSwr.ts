import useSWRMutation from "swr/mutation"
import { mutateResendTelegramCode } from "@/modules/api/graphql/mutations/mutation-resend-telegram-code"
import type { MutateResendTelegramCodeRequest } from "@/modules/api/graphql/mutations/mutation-resend-telegram-code"

/** What the resendTelegramCode mutation is triggered with. */
interface ResendTelegramCodeArg {
    readonly arg: MutateResendTelegramCodeRequest
}

/** The SWR key of the resendTelegramCode mutation. */
export const MUTATE_RESEND_TELEGRAM_CODE_SWR_KEY = "MUTATE_RESEND_TELEGRAM_CODE_SWR"

/** SWR mutation for {@link mutateResendTelegramCode}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateResendTelegramCodeSwr = () =>
    useSWRMutation(MUTATE_RESEND_TELEGRAM_CODE_SWR_KEY, async (_key: string, { arg }: ResendTelegramCodeArg) => {
        const result = await mutateResendTelegramCode({ request: arg })
        if (result.data === undefined || result.data === null) throw new Error("resendTelegramCode answered no data")
        return result.data.resendTelegramCode
    })
