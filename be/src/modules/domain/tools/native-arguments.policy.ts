import { ToolsError, ToolsErrorCode } from "./errors/tools.error"
import type { ToolJson } from "./tools.contracts"

/** The error of a tool the connector does not have. */
export const unknownTool = (tool: string): ToolsError =>
    new ToolsError({ code: ToolsErrorCode.UnknownTool, params: { tool } })

/** The error of a call whose arguments do not fit the tool's validator. */
export const invalidArguments = (tool: string): ToolsError =>
    new ToolsError({ code: ToolsErrorCode.InvalidArguments, params: { tool } })

/** What reading the arguments of a call answers: the data when they fit, a failure when they do not. */
export type ArgumentReading<Input> = { readonly success: true; readonly data: Input } | { readonly success: false }

/** A validator of a tool's arguments: what a schema of the capability offers, whatever library built it. */
export interface ArgumentReader<Input> {
    /** Reads the arguments; the data when they fit. */
    safeParse(args: ToolJson): ArgumentReading<Input>
}

/** The arguments of a call read through the tool's validator; refused as invalid arguments when they do not fit. */
export const argumentsOf = <Input>(tool: string, schema: ArgumentReader<Input>, args: ToolJson): Input => {
    const parsed = schema.safeParse(args)
    if (!parsed.success) throw invalidArguments(tool)
    return parsed.data
}
