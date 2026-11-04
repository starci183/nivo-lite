"use client"

import {
    queryTestDatabase,
    type queryTestDatabase as QueryTestDatabaseOperation,
} from "@/modules/api/graphql/queries/query-test-database"
import useSWRMutation from "swr/mutation"
import type { SWRMutationResponse } from "swr/mutation"
import type { TestDatabaseQuery } from "@/modules/api"

/** The SWR key of the testDatabase query. */
export const QUERY_TEST_DATABASE_SWR_KEY = "QUERY_TEST_DATABASE_SWR"

/** The argument the trigger of this hook is called with. */
interface TriggerArg {
    readonly arg: Parameters<typeof QueryTestDatabaseOperation>[0]["request"]
}

/** Lazily connects read only to the owner database; `trigger(input)` answers its tables and rejects with the back end failure. */
export const useQueryTestDatabaseSwr = (): SWRMutationResponse<
    TestDatabaseQuery["testDatabase"],
    Error,
    typeof QUERY_TEST_DATABASE_SWR_KEY,
    TriggerArg["arg"]
> =>
    useSWRMutation(QUERY_TEST_DATABASE_SWR_KEY, async (_key: string, { arg }: TriggerArg) => {
        const result = await queryTestDatabase({ request: arg })
        if (!result.data) throw new Error("testDatabase answered no data")
        return result.data.testDatabase
    })
