import useSWRMutation from "swr/mutation"
import { mutateSetDefaultSmtp } from "@/modules/api/graphql/mutations/mutation-set-default-smtp"
import type { MutateSetDefaultSmtpRequest } from "@/modules/api/graphql/mutations/mutation-set-default-smtp"

/** What the setDefaultSmtp mutation is triggered with. */
interface SetDefaultSmtpArg {
    readonly arg: MutateSetDefaultSmtpRequest
}

/** The SWR key of the setDefaultSmtp mutation. */
export const MUTATE_SET_DEFAULT_SMTP_SWR_KEY = "MUTATE_SET_DEFAULT_SMTP_SWR"

/** SWR mutation for {@link mutateSetDefaultSmtp}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateSetDefaultSmtpSwr = () =>
    useSWRMutation(MUTATE_SET_DEFAULT_SMTP_SWR_KEY, async (_key: string, { arg }: SetDefaultSmtpArg) => {
        const result = await mutateSetDefaultSmtp({ request: arg })
        if (result.data === undefined || result.data === null) throw new Error("setDefaultSmtp answered no data")
        return result.data.setDefaultSmtp
    })
