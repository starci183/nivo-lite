import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { DriveGrantService } from "./drive-grant.service"
import { GoogleConnectionsService } from "./google-connections.service"
import { GoogleSheetsService } from "./google-sheets.service"
import { GoogleSheetAutomationService } from "./google-sheet-automation.service"
import { GoogleTokensService } from "./google-tokens.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./google-connections.module-definition"

@Module({})
/**
 * The Google account connections, the orders spreadsheet automation (registered with the automations engine) and the Drive read grant
 * the knowledge capability reads with, over the connections capability.
 */
export class GoogleConnectionsModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                GoogleTokensService,
                DriveGrantService,
                GoogleConnectionsService,
                GoogleSheetsService,
                GoogleSheetAutomationService,
            ],
            exports: [GoogleConnectionsService, DriveGrantService],
        }
    }
}
