"use client"

import { queryTestDatabase } from "@/modules/api/graphql/queries/query-test-database"
import type { queryTestDatabase as QueryTestDatabaseOperation } from "@/modules/api/graphql/queries/query-test-database"
import useSWRMutation from "swr/mutation"

/** The SWR key of the testDatabase query. */
export const QUERY_TEST_DATABASE_SWR_KEY = "QUERY_TEST_DATABASE_SWR"

/** The argument the trigger of this hook is called with. */
interface TriggerArg {
    readonly arg: Parameters<typeof QueryTestDatabaseOperation>[0]["request"]
}

/** Lazily connects read only to the owner database; `trigger(input)` answers its tables and rejects with the back end failure. */
export const useQueryTestDatabaseSwr = () =>
    useSWRMutation(QUERY_TEST_DATABASE_SWR_KEY, async (_key: string, { arg }: TriggerArg) => {
        const result = await queryTestDatabase({ request: arg })
        if (!result.data) throw new Error("testDatabase answered no data")
        return result.data.testDatabase
    })
