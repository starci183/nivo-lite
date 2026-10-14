"use client"

import { useGraphQLMutationSwr } from "@/hooks/reuseables"
import { queryTestOpenApiOperation } from "@/modules/api/graphql/queries/query-test-open-api-operation"

/** The SWR key of the testOpenApiOperation query. */
export const QUERY_TEST_OPEN_API_OPERATION_SWR_KEY = "QUERY_TEST_OPEN_API_OPERATION_SWR"

/** Lazy SWR query for {@link queryTestOpenApiOperation}: `trigger(input)` answers the test result and rejects with the back end failure. */
export const useQueryTestOpenApiOperationSwr = () =>
    useGraphQLMutationSwr(
        QUERY_TEST_OPEN_API_OPERATION_SWR_KEY,
        async (params: Parameters<typeof queryTestOpenApiOperation>[0]) => {
            const result = await queryTestOpenApiOperation(params)
            if (!result.data) throw new Error("testOpenApiOperation answered no data")
            return result
        },
        (data) => data.testOpenApiOperation,
    )
