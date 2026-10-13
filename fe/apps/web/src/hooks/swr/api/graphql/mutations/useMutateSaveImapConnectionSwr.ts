import useSWRMutation from "swr/mutation"
import { mutateSaveImapConnection } from "@/modules/api/graphql/mutations/mutation-save-imap-connection"
import type { MutateSaveImapConnectionRequest } from "@/modules/api/graphql/mutations/mutation-save-imap-connection"

/** What the saveImapConnection mutation is triggered with. */
interface SaveImapConnectionArg {
    readonly arg: MutateSaveImapConnectionRequest
}

/** The SWR key of the saveImapConnection mutation. */
export const MUTATE_SAVE_IMAP_CONNECTION_SWR_KEY = "MUTATE_SAVE_IMAP_CONNECTION_SWR"

/** SWR mutation for {@link mutateSaveImapConnection}: `trigger(input)` answers the connection id and rejects with the back end failure. */
export const useMutateSaveImapConnectionSwr = () =>
    useSWRMutation(MUTATE_SAVE_IMAP_CONNECTION_SWR_KEY, async (_key: string, { arg }: SaveImapConnectionArg) => {
        const result = await mutateSaveImapConnection({ request: arg })
        if (result.data === undefined || result.data === null) throw new Error("saveImapConnection answered no data")
        return result.data.saveImapConnection
    })
