"use client"

import useSWR from "swr"
import type { SWRConfiguration } from "swr"

/** The part of an Apollo query result the hook reads. */
interface QueryAnswer<TData> {
    readonly data?: TData | null
}

/**
 * The SWR read of one GraphQL query keyed by one argument (`[key, argument]`): idle while the argument is `undefined`, failing
 * with the back end failure or an empty answer, and answering the payload `pick` takes out of the data.
 */
export const useKeyedQuerySwr = <TArgument, TData, TPayload>(
    key: string,
    argument: TArgument | undefined,
    run: (argument: TArgument) => Promise<QueryAnswer<TData>>,
    pick: (data: TData) => TPayload,
    options?: SWRConfiguration<NoInfer<TPayload>, Error>,
) =>
    useSWR(
        argument === undefined ? null : ([key, argument] as const),
        async ([, value]: readonly [string, TArgument]): Promise<TPayload> => {
            const result = await run(value)
            if (result.data === undefined || result.data === null) throw new Error(`${key} answered no data`)
            return pick(result.data)
        },
        options,
    )
