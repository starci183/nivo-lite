"use client"

import { mutateSaveImapConnection } from "@/modules/api/graphql/mutations/mutation-save-imap-connection"
import type { MutateSaveImapConnectionRequest } from "@/modules/api/graphql/mutations/mutation-save-imap-connection"
import useSWRMutation from "swr/mutation"
import { answeredData } from "@/hooks/workspaceread"

/** The SWR key of the saveImapConnection mutation. */
export const MUTATE_SAVE_IMAP_CONNECTION_SWR_KEY = "MUTATE_SAVE_IMAP_CONNECTION_SWR"

/** SWR mutation for {@link mutateSaveImapConnection}: `trigger(input)` answers the connection id and rejects with the back end failure. */
export const useMutateSaveImapConnectionSwr = () =>
    useSWRMutation(
        MUTATE_SAVE_IMAP_CONNECTION_SWR_KEY,
        async (_key: string, { arg }: TriggerArg) =>
            answeredData(await mutateSaveImapConnection({ request: arg }), MUTATE_SAVE_IMAP_CONNECTION_SWR_KEY)
                .saveImapConnection,
    )

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: MutateSaveImapConnectionRequest
}
