"use client"

import { queryTestOpenApiOperation } from "@/modules/api/graphql/queries/query-test-open-api-operation"
import type { QueryTestOpenApiOperationRequest } from "@/modules/api/graphql/queries/query-test-open-api-operation"
import useSWRMutation from "swr/mutation"

/** The SWR key of the testOpenApiOperation query. */
export const QUERY_TEST_OPEN_API_OPERATION_SWR_KEY = "QUERY_TEST_OPEN_API_OPERATION_SWR"

/** Lazy SWR query for {@link queryTestOpenApiOperation}: `trigger(input)` answers the test result and rejects with the back end failure. */
export const useQueryTestOpenApiOperationSwr = () =>
    useSWRMutation(QUERY_TEST_OPEN_API_OPERATION_SWR_KEY, async (_key: string, { arg }: TriggerArg) => {
        const result = await queryTestOpenApiOperation({ request: arg })
        if (!result.data) throw new Error("testOpenApiOperation answered no data")
        return result.data.testOpenApiOperation
    })

/** The request accepted by this operation trigger. */
interface TriggerArg {
    readonly arg: QueryTestOpenApiOperationRequest
}
