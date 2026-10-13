import { useGraphQLMutationSwr } from "@/hooks/reuseables"
import { mutateStartSmtpConnection } from "@/modules/api/graphql/mutations/mutation-start-smtp-connection"

/** The SWR key of the startSmtpConnection mutation. */
export const MUTATE_START_SMTP_CONNECTION_SWR_KEY = "MUTATE_START_SMTP_CONNECTION_SWR"

/** SWR mutation for {@link mutateStartSmtpConnection}: `trigger(input)` answers the payload and rejects with the back end failure. */
export const useMutateStartSmtpConnectionSwr = () =>
    useGraphQLMutationSwr(
        MUTATE_START_SMTP_CONNECTION_SWR_KEY,
        mutateStartSmtpConnection,
        (data) => data.startSmtpConnection,
    )
