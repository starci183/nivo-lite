"use client"

import useSWRMutation from "swr/mutation"
import { mutateSaveDatabaseConnection } from "@/modules/api/graphql/mutations/mutation-save-database-connection"
import type { MutateSaveDatabaseConnectionRequest } from "@/modules/api/graphql/mutations/mutation-save-database-connection"

/** What the saveDatabaseConnection mutation is triggered with. */
interface SaveDatabaseConnectionArg {
    readonly arg: MutateSaveDatabaseConnectionRequest
}

/** The SWR key of the saveDatabaseConnection mutation. */
export const MUTATE_SAVE_DATABASE_CONNECTION_SWR_KEY = "MUTATE_SAVE_DATABASE_CONNECTION_SWR"

/** SWR mutation for {@link mutateSaveDatabaseConnection}: `trigger(input)` answers the connection id and rejects with the back end failure. */
export const useMutateSaveDatabaseConnectionSwr = () =>
    useSWRMutation(
        MUTATE_SAVE_DATABASE_CONNECTION_SWR_KEY,
        async (_key: string, { arg }: SaveDatabaseConnectionArg) => {
            const result = await mutateSaveDatabaseConnection({ request: arg })
            if (result.data === undefined || result.data === null)
                throw new Error("saveDatabaseConnection answered no data")
            return result.data.saveDatabaseConnection
        },
    )
