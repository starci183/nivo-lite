"use client"

import useSWRMutation from "swr/mutation"
import { queryTestImapConnection } from "@/modules/api/graphql/queries/query-test-imap-connection"

/** The variables of the lazily triggered testImapConnection query. */
export type QueryTestImapConnectionRequest = Parameters<typeof queryTestImapConnection>[0]["request"]

/** The SWR key of the testImapConnection query. */
export const QUERY_TEST_IMAP_CONNECTION_SWR_KEY = "QUERY_TEST_IMAP_CONNECTION_SWR"

/** The argument the trigger of this hook is called with. */
interface TriggerArg {
    readonly arg: QueryTestImapConnectionRequest
}

/** Lazily logs in to a mailbox read only; `trigger(input)` answers its folders and rejects with the back end failure. */
export const useQueryTestImapConnectionSwr = () =>
    useSWRMutation(QUERY_TEST_IMAP_CONNECTION_SWR_KEY, async (_key: string, { arg }: TriggerArg) => {
        const result = await queryTestImapConnection({ request: arg })
        if (!result.data) throw new Error("testImapConnection answered no data")
        return result.data.testImapConnection
    })
