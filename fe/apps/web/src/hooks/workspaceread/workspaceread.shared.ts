import type { SWRConfiguration } from "swr"

/** How often a queued job is asked for its status until it ends. */
const JOB_POLL_MS = 2000

/** What a queued job reports. */
interface JobStatus {
    readonly status: string
}

/** The failure of a read whose response carried no data. */
export const noData = (name: string): never => {
    throw new Error(`${name} answered no data`)
}

/** SWR options for the status of queued work: asked again every few seconds until the job succeeded or failed. */
export const jobPolling = (options?: SWRConfiguration): SWRConfiguration => ({
    refreshInterval: (data?: JobStatus) =>
        data?.status === "succeeded" || data?.status === "failed" ? 0 : JOB_POLL_MS,
    ...options,
})

/** Callbacks for a queued operation whose status is polled through its SWR wrapper. */
export interface StatusPollOptions {
    readonly onSuccess?: (progress: ProgressInput1) => void
    readonly onError?: (error: unknown) => void
}

/** The part of an Apollo answer {@link answeredData} reads. */
interface GraphQLAnswer<T> {
    readonly data?: T | null | undefined
}

/** The data of a GraphQL answer; a missing one is a failure named after the operation. */
export const answeredData = <T>(result: GraphQLAnswer<T>, operation: string): T => {
    if (!result.data) throw new Error(`${operation} answered no data`)
    return result.data
}

type ProgressInput1 = { readonly status: string }

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
const terminalInterval = (intervalMs: number) => (progress: PolledStatus | undefined) =>
    progress?.status === "succeeded" || progress?.status === "failed" ? 0 : intervalMs

/** The shared job cadence, followed by the caller's callbacks/options. */
export const terminalJobOptions = <Callbacks extends object>(callbacks: Callbacks, intervalMs = 2000) => ({
    refreshInterval: terminalInterval(intervalMs),
    ...callbacks,
})

/** Status polling keeps caller callbacks and disables focus refresh. */
export const terminalStatusOptions = <Callbacks extends object>(intervalMs: number, callbacks: Callbacks) => ({
    ...callbacks,
    refreshInterval: terminalInterval(intervalMs),
    revalidateOnFocus: false,
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

/** Reads a required field; missing data or a missing field has the same named failure. */
export const readRequiredField = async <Request, Data, Field extends keyof Data & string>(
    run: ReadOperation<Request, Data>,
    request: Request,
    field: Field,
): Promise<NonNullable<Data[Field]>> => (await run({ request })).data?.[field] ?? noData(field)

/** The success/error callbacks accepted while a queued job is observed. */
export type JobStatusCallbacks<Status> = Pick<SWRConfiguration<Status, Error>, "onSuccess" | "onError">

/** The part of an SWR read that carries its failure. */
interface SwrFailing {
    readonly error?: unknown
}

/** The failure of an SWR read, as `unknown`: SWR types a read's error as `any`, which may not flow on untyped. */
export const readError = (read: SwrFailing): unknown => read.error
