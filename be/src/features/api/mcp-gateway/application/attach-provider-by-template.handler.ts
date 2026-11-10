import { CommandHandler } from "@nestjs/cqrs"
import { McpGatewayAdminService } from "@modules/domain/mcp-gateway"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AttachProviderByTemplateCommand } from "./attach-provider-by-template.command"

@CommandHandler(AttachProviderByTemplateCommand)
/** Attaches the listed agents to a provider by their template. The admin service checks the owner or manager role. */
export class AttachProviderByTemplateHandler extends ICQRSHandler<
    AttachProviderByTemplateCommand,
    ReadonlyArray<string>
> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly admin: McpGatewayAdminService,
    ) {
        super(logger)
    }

    protected override process(command: AttachProviderByTemplateCommand): Promise<ReadonlyArray<string>> {
        return this.admin.attachByTemplate(
            { principalId: command.params.principal.id, workspaceId: command.params.request.workspaceId },
            command.params.request.connectionId,
            command.params.request.agentIds,
        )
    }
}
