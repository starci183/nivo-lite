import { useGraphQLMutationSwr } from "@/hooks/reuseables"
import { mutateSaveImapConnection } from "@/modules/api/graphql/mutations/mutation-save-imap-connection"

/** The SWR key of the saveImapConnection mutation. */
export const MUTATE_SAVE_IMAP_CONNECTION_SWR_KEY = "MUTATE_SAVE_IMAP_CONNECTION_SWR"

/** SWR mutation for {@link mutateSaveImapConnection}: `trigger(input)` answers the connection id and rejects with the back end failure. */
export const useMutateSaveImapConnectionSwr = () =>
    useGraphQLMutationSwr(
        MUTATE_SAVE_IMAP_CONNECTION_SWR_KEY,
        mutateSaveImapConnection,
        (data) => data.saveImapConnection,
    )
