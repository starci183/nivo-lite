import useSWRMutation from "swr/mutation"
import { mutateChangeSmtpPassword } from "@/modules/api/graphql/mutations/mutation-change-smtp-password"
import type { MutateChangeSmtpPasswordRequest } from "@/modules/api/graphql/mutations/mutation-change-smtp-password"

/** What the changeSmtpPassword mutation is triggered with. */
interface ChangeSmtpPasswordArg {
    readonly arg: MutateChangeSmtpPasswordRequest
}

/** The SWR key of the changeSmtpPassword mutation. */
export const MUTATE_CHANGE_SMTP_PASSWORD_SWR_KEY = "MUTATE_CHANGE_SMTP_PASSWORD_SWR"

/** SWR mutation for {@link mutateChangeSmtpPassword}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateChangeSmtpPasswordSwr = () =>
    useSWRMutation(MUTATE_CHANGE_SMTP_PASSWORD_SWR_KEY, async (_key: string, { arg }: ChangeSmtpPasswordArg) => {
        const result = await mutateChangeSmtpPassword({ request: arg })
        if (result.data === undefined || result.data === null) throw new Error("changeSmtpPassword answered no data")
        return result.data.changeSmtpPassword
    })
