import { Module, type DynamicModule } from "@nestjs/common"
import { INBOX, InboxService } from "@modules/platform/inbox"
import { ToolReceiptsService } from "./tool-receipts.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./tool-receipts.module-definition"

@Module({})
/** Owns sealed MCP operation receipts and their transactional inbox claims over the primary database. */
export class ToolReceiptsModule extends ConfigurableModuleClass {
    /** Registers the receipt capability in the app that serves MCP calls. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), { provide: INBOX, useClass: InboxService }, ToolReceiptsService],
            exports: [ToolReceiptsService],
        }
    }
}
