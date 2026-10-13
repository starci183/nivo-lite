/** What a tool answered. */
export class ToolResultResponse {
    /** Always true: a refused call is an error answer, never this body. */
    ok!: boolean
    /** The JSON object the tool produced. */
    result!: Record<string, unknown>
}

/** One tool the agent may call. */
export class ToolManifestEntryResponse {
    /** The dotted tool name. */
    name!: string
    /** What the tool does, for the model. */
    description!: string
    /** Argument name to type text; a trailing question mark marks an optional argument. */
    args!: Record<string, string>
}

/** The tools OpenClaw may call. */
export class ToolManifestResponse {
    /** The tools. */
    tools!: Array<ToolManifestEntryResponse>
}
