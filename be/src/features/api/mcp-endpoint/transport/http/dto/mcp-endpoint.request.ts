import { Allow, IsIn, IsObject, IsOptional, IsString, MaxLength } from "class-validator"

/** One JSON-RPC 2.0 message of the MCP Streamable HTTP transport (a request, or a notification without an id). */
export class McpEndpointRequest {
    /** Always "2.0". */
    @IsString()
    @IsIn(["2.0"])
    jsonrpc!: "2.0"

    /** The request id (a string or a number); absent for a notification. */
    @IsOptional()
    @Allow()
    id?: string | number

    /** The MCP method, for example tools/call. */
    @IsString()
    @MaxLength(100)
    method!: string

    /**
     * The method parameters, an object whose shape depends on the method; the MCP protocol (official SDK) validates them per
     * method, so no class here could name their members.
     */
    @IsOptional()
    @IsObject()
    params?: unknown
}
