import { QueryHandler } from "@nestjs/cqrs"
import { AgentToolsService } from "@modules/domain/agent-tools"
import type { ToolManifestEntry } from "@modules/domain/agent-tools"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { GetToolManifestQuery } from "./get-tool-manifest.query"

@QueryHandler(GetToolManifestQuery)
/** Answers the tool manifest from the agent tools service. */
export class GetToolManifestHandler extends ICQRSHandler<GetToolManifestQuery, ReadonlyArray<ToolManifestEntry>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly tools: AgentToolsService,
    ) {
        super(logger)
    }

    protected override process(): Promise<ReadonlyArray<ToolManifestEntry>> {
        return this.tools.describeTools()
    }
}
