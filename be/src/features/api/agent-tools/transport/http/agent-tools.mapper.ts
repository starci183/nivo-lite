import type { JsonResult, ToolManifestEntry } from "@modules/domain/agent-tools"
import type { RunToolRequest as RunToolCommandRequest } from "../../application/run-tool.contracts"
import type { RunToolRequest } from "./dto/run-tool.request"
import type { ToolManifestResponse, ToolResultResponse } from "./dto/tool-result.response"

/** Maps the authorization header, the tool name and the flat body of the HTTP request to the application request. */
export const toRunToolRequest = (
    authorization: string | undefined,
    tool: string,
    input: RunToolRequest,
): RunToolCommandRequest => ({
    authorization,
    tool,
    args: { ...input },
})

/** Maps what a tool answered to the HTTP response. */
export const toToolResultResponse = (result: JsonResult): ToolResultResponse => ({ ok: true, result: { ...result } })

/** Maps the manifest to the HTTP response. */
export const toToolManifestResponse = (result: ReadonlyArray<ToolManifestEntry>): ToolManifestResponse => ({
    tools: result.map((entry) => ({ ...entry })),
})
