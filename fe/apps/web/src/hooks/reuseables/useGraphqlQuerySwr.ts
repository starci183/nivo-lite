import useSWR from "swr"
import type { SWRConfiguration } from "swr"

/** What one GraphQL query answers: the typed payload, or nothing when the back end sent no data. */
interface GraphqlAnswer {
    readonly data?: unknown
}

/**
 * The SWR read of one GraphQL query with a request: keyed by the request, idle while the request is `null`, and failing with
 * the back end failure (or an empty answer). The query hooks of `hooks/swr` wrap it with their key, operation and the field they answer.
 */
export const useGraphqlQuerySwr = <TRequest, TAnswer extends GraphqlAnswer, TOut>(
    key: string,
    request: TRequest | null,
    run: (request: TRequest) => Promise<TAnswer>,
    select: (data: NonNullable<TAnswer["data"]>) => TOut,
    config?: SWRConfiguration,
) =>
    useSWR<TOut>(
        request === null ? null : [key, request],
        async ([, input]: readonly [string, TRequest]) => {
            const result = await run(input)
            if (result.data === undefined || result.data === null) throw new Error(`${key} answered no data`)
            return select(result.data)
        },
        config,
    )
