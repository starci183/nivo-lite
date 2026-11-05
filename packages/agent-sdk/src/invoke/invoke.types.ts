import type { InputProblem } from "../block/block.types"

/** The codes of a refusal the invoke path raises itself, carried as `data.code` of a `failed` result. */
export type InvokeFailureCode = "INVOKE_NOT_PACKAGE" | "INVOKE_EXTERNAL_IN_TX"

/** How invoking a read ended: its data, the problems of its variables, or a failure of the path. */
export type InvokeReadResult =
    | { readonly ok: true; readonly data: unknown }
    | { readonly ok: false; readonly reason: "invalid"; readonly problems: ReadonlyArray<InputProblem> }
    | { readonly ok: false; readonly reason: "failed"; readonly code: string; readonly at: string }

/** How invoking a job ended: it ran, or its payload was refused. A failure of the run itself is thrown, for the processor to classify. */
export type InvokeJobResult =
    | { readonly ok: true }
    | { readonly ok: false; readonly reason: "invalid"; readonly problems: ReadonlyArray<InputProblem> }
