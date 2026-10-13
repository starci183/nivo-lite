import useSWRMutation from "swr/mutation"

/** What the SWR mutation trigger hands the fetcher. */
interface TriggerArg<TRequest> {
    readonly arg: TRequest
}

/** The part of an Apollo mutation result the hook reads. */
interface MutationAnswer<TData> {
    readonly data?: TData | null
}

/**
 * The one SWR mutation shape of every GraphQL write: runs the operation file with the trigger argument as its request, rejects
 * with the back end failure, and answers the payload `pick` takes out of the data.
 */
export const useGraphQLMutationSwr = <TRequest, TData, TPayload>(
    key: string,
    run: (params: { readonly request: TRequest }) => Promise<MutationAnswer<TData>>,
    pick: (data: TData) => TPayload,
) =>
    useSWRMutation(key, async (_key: string, { arg }: TriggerArg<TRequest>): Promise<TPayload> => {
        const result = await run({ request: arg })
        if (result.data === undefined || result.data === null) throw new Error(`${key} answered no data`)
        return pick(result.data)
    })
