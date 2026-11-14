import { CommandHandler } from "@nestjs/cqrs"
import { ChannelFrontDoorService } from "@modules/domain/agent-instances"
import { ZaloConnectService } from "@modules/domain/channels"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import type { ZaloWizardConnection } from "@modules/domain/channel-connections"
import { ReturnZaloAuthorizationCommand } from "./return-zalo-authorization.command"

@CommandHandler(ReturnZaloAuthorizationCommand)
/**
 * Finishes the Zalo sign-in with what Zalo returned the browser with through the ZaloConnectService, then makes sure the channel has the
 * agent that answers it (a failure to install it fails the connect and marks the connection in error).
 */
export class ReturnZaloAuthorizationHandler extends ICQRSHandler<ReturnZaloAuthorizationCommand, ZaloWizardConnection> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly zalo: ZaloConnectService,
        private readonly frontDoor: ChannelFrontDoorService,
    ) {
        super(logger)
    }

    protected override async process(command: ReturnZaloAuthorizationCommand): Promise<ZaloWizardConnection> {
        const actor = { principalId: command.params.principal.id, workspaceId: command.params.request.workspaceId }
        const connected = await this.zalo.finishAuthorization(actor, {
            state: command.params.request.state,
            code: command.params.request.code,
            oaId: command.params.request.oaId,
        })
        const door = await this.frontDoor.ensureForConnection(actor, connected.id)
        return door.kind === "installed" || door.kind === "attached"
            ? { ...connected, agentIds: [...connected.agentIds, door.agentId] }
            : connected
    }
}
