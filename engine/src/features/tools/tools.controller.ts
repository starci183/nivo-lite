import { Body, Controller, Get, Headers, HttpException, HttpStatus, Logger, Param, Post } from "@nestjs/common";
import { NivoClient, NivoHttpError } from "../../platform/nivo/nivo-client.service";
import { ToolTokenService } from "../../platform/tools/tool-token.service";
import { isToolName, TOOL_MANIFEST } from "./tool-manifest";

/**
 * The tool bridge OpenClaw calls (internal network only; Caddy does not publish it).
 * Authorization is a per-job bearer token minted by the chat.turn handler: it names the job (so the workspace and conversation), expires
 * with the turn, and dies when the job ends. The tenant is therefore fixed on the engine side; the app re-derives it from the job and
 * never trusts an id in the request body.
 */
@Controller("tools")
export class ToolsController {
  private readonly log = new Logger(ToolsController.name);

  constructor(private readonly tokens: ToolTokenService, private readonly nivo: NivoClient) {}

  @Get()
  manifest() {
    return { tools: TOOL_MANIFEST };
  }

  @Post(":name")
  async call(@Param("name") name: string, @Headers("authorization") authorization: string | undefined, @Body() body: unknown) {
    const claims = this.tokens.verify(authorization?.replace(/^Bearer\s+/i, ""));
    if (!claims) throw new HttpException("invalid, expired or exhausted tool token", HttpStatus.UNAUTHORIZED);
    if (!isToolName(name)) throw new HttpException("unknown tool", HttpStatus.NOT_FOUND);
    const args = body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
    try {
      return await this.nivo.call<{ ok: boolean; result: unknown }>("/api/engine/tool", { job_id: claims.jobId, tool: name, args });
    } catch (e) {
      this.log.warn(`tool ${name} for job ${claims.jobId} failed: ${(e as Error).message}`);
      if (e instanceof NivoHttpError && e.status < 500) throw new HttpException("the app rejected the tool call", e.status);
      throw new HttpException("tool call failed", HttpStatus.BAD_GATEWAY);
    }
  }
}
