import type { SWRConfiguration, SWRResponse } from "swr"

/** The failure of a read whose response carried no data. */
export const noData = (name: string): never => {
    throw new Error(`${name} answered no data`)
}

/** The part of an Apollo answer {@link answeredData} reads. */
interface GraphQLAnswer<T> {
    readonly data?: T | null | undefined
}

/** The data object one GraphQL operation answers, with the missing-data case removed: what a hook reads a field of. */
export type OperationData<Operation extends (params: never) => Promise<GraphQLAnswer<object>>> = NonNullable<
    Awaited<ReturnType<Operation>>["data"]
>

/** The SWR response of a read hook: its data, the `Error` it fails with, and the options it takes, so an option callback is typed by the data. */
export type ReadResponse<Data> = SWRResponse<Data, Error, SWRConfiguration<Data, Error>>

/** The data of a GraphQL answer; a missing one is a failure named after the operation. */
export const answeredData = <T>(result: GraphQLAnswer<T>, operation: string): T => {
    if (!result.data) throw new Error(`${operation} answered no data`)
    return result.data
}

/** An argument-keyed read waits until the argument is defined. */
export const argumentKey = <Argument>(
    name: string,
    argument: Argument | undefined,
): readonly [string, Argument] | null => (argument === undefined ? null : [name, argument])

/** Explicit workspace reads wait until both the workspace and argument are known. */
export const workspaceArgumentKey = <Argument>(
    name: string,
    workspaceId: string | undefined,
    argument: Argument | undefined,
): readonly [string, string, Argument] | null =>
    workspaceId === undefined || argument === undefined ? null : [name, workspaceId, argument]

/** The terminal states understood by queued operation polling. */
interface PolledStatus {
    readonly status: string
}

/** Polls a queued job only until its authoritative terminal state. */
const terminalInterval =
    (intervalMs: number) =>
    (progress: PolledStatus | undefined): number =>
        progress?.status === "succeeded" || progress?.status === "failed" ? 0 : intervalMs

type TerminalJobOptionsResult<Callbacks extends object> = {
    refreshInterval: (progress: PolledStatus | undefined) => number
} & Callbacks

/** The shared job cadence, followed by the caller's callbacks/options. */
export const terminalJobOptions = <Callbacks extends object>(
    callbacks: Callbacks,
    intervalMs = 2000,
): TerminalJobOptionsResult<Callbacks> => ({
    refreshInterval: terminalInterval(intervalMs),
    ...callbacks,
})

/** The cache identity of one argument/request read in a workspace. */
export type WorkspaceReadKey<Argument> = readonly [name: string, workspaceId: string, argument: Argument]

/** The typed request envelope accepted by a GraphQL read. */
interface ReadRequest<Request> {
    readonly request: Request
}

/** One GraphQL operation's request and answer contract. */
type ReadOperation<Request, Data> = (params: ReadRequest<Request>) => Promise<GraphQLAnswer<Data>>

/** Reads one field while preserving the operation's missing-data failure text. */
export const readField = async <Request, Data, Field extends keyof Data>(
    run: ReadOperation<Request, Data>,
    request: Request,
    field: Field,
    operation: string,
): Promise<Data[Field]> => answeredData(await run({ request }), operation)[field]

/** The success/error callbacks accepted while a queued job is observed. */
export type JobStatusCallbacks<Status> = Pick<SWRConfiguration<Status, Error>, "onSuccess" | "onError">

/** The part of an SWR read that carries its failure. */
interface SwrFailing {
    readonly error?: unknown
}

/** The failure of an SWR read, as `unknown`: SWR types a read's error as `any`, which may not flow on untyped. */
export const readError = (read: SwrFailing): unknown => read.error
