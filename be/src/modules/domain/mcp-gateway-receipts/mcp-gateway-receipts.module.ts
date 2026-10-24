import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { INBOX, InboxService } from "@modules/platform/inbox"
import { GatewayReceiptsService } from "./gateway-receipts.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./mcp-gateway-receipts.module-definition"

@Module({})
/** Owns sealed MCP operation receipts and their transactional inbox claims over the primary database. */
export class McpGatewayReceiptsModule extends ConfigurableModuleClass {
    /** Registers the receipt capability in the app that serves MCP calls. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), { provide: INBOX, useClass: InboxService }, GatewayReceiptsService],
            exports: [GatewayReceiptsService],
        }
    }
}
