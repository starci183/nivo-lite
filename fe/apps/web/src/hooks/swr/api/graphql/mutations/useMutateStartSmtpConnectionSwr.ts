import useSWRMutation from "swr/mutation"
import { mutateStartSmtpConnection } from "@/modules/api/graphql/mutations/mutation-start-smtp-connection"
import type { MutateStartSmtpConnectionRequest } from "@/modules/api/graphql/mutations/mutation-start-smtp-connection"

/** What the startSmtpConnection mutation is triggered with. */
interface StartSmtpConnectionArg {
    readonly arg: MutateStartSmtpConnectionRequest
}

/** The SWR key of the startSmtpConnection mutation. */
export const MUTATE_START_SMTP_CONNECTION_SWR_KEY = "MUTATE_START_SMTP_CONNECTION_SWR"

/** SWR mutation for {@link mutateStartSmtpConnection}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateStartSmtpConnectionSwr = () =>
    useSWRMutation(MUTATE_START_SMTP_CONNECTION_SWR_KEY, async (_key: string, { arg }: StartSmtpConnectionArg) => {
        const result = await mutateStartSmtpConnection({ request: arg })
        if (result.data === undefined || result.data === null) throw new Error("startSmtpConnection answered no data")
        return result.data.startSmtpConnection
    })
