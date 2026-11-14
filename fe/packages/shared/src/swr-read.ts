import type { SWRConfiguration, SWRResponse } from "swr"

/** The SWR response of a read hook: its data, the `Error` it fails with, and the options it takes, so an option callback is typed by the data. */
export type ReadResponse<Data> = SWRResponse<Data, Error, SWRConfiguration<Data, Error>>

/** The part of an SWR read that carries its failure. */
interface SwrFailing {
    readonly error?: unknown
}

/** The failure of an SWR read, as `unknown`: SWR types a read's error as `any`, which may not flow on untyped. */
export const readError = (read: SwrFailing): unknown => read.error
