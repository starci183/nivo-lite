import { SdkError } from "../sdk-error"

/** Whether a thrown value is an SDK error. */
const isSdkError = (error: unknown): error is SdkError<string> => error instanceof SdkError

/** The code and subject of an SDK error, or undefined for any other thrown value (a bug of the run, which must propagate). */
export const sdkFailureOf = (error: unknown): { readonly code: string; readonly at: string } | undefined =>
    isSdkError(error) ? { code: error.code, at: error.at } : undefined
