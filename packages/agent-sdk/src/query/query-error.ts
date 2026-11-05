import { SdkError } from "../sdk-error"

/** The codes `listQueryOf` and `countsOf` refuse with. */
export type QueryBuildErrorCode =
    "LIST_SORT_UNKNOWN" | "LIST_FILTER_UNKNOWN" | "LIST_FILTER_VALUE_UNKNOWN" | "LIST_FILTER_CASE_INVALID"

/** Thrown when a list shape and a list query cannot be turned into a tree: the shape or the parsed variables are wrong, a bug. */
export class QueryBuildError extends SdkError<QueryBuildErrorCode> {}
