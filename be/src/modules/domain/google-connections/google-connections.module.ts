import { Module } from "@nestjs/common"
import type { DynamicModule, OnModuleInit } from "@nestjs/common"
import { LedgerRegistryService } from "@modules/domain/provider-registry"
import { DriveGrantService } from "./drive-grant.service"
import { GoogleConnectionsService } from "./google-connections.service"
import { GoogleLedgerService } from "./google-ledger.service"
import { GoogleSheetsService } from "./google-sheets.service"
import { GoogleSheetAutomationService } from "./google-sheet-automation.service"
import { GoogleTokensService } from "./google-tokens.service"
import { SheetsGrantService } from "./sheets-grant.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./google-connections.module-definition"

@Module({})
/**
 * The Google account connections, the orders spreadsheet automation (registered with the automations engine), the Drive read grant
 * the knowledge capability reads with, and the ledger the workspace keeps in a spreadsheet (registered with the ledger providers), over
 * the connections capability.
 */
export class GoogleConnectionsModule extends ConfigurableModuleClass implements OnModuleInit {
    constructor(
        private readonly ledgers: LedgerRegistryService,
        private readonly ledger: GoogleLedgerService,
    ) {
        super()
    }

    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                GoogleTokensService,
                DriveGrantService,
                SheetsGrantService,
                GoogleLedgerService,
                GoogleConnectionsService,
                GoogleSheetsService,
                GoogleSheetAutomationService,
            ],
            exports: [GoogleConnectionsService, DriveGrantService, SheetsGrantService],
        }
    }

    /** Hands the Google ledger to the ledger providers. */
    onModuleInit(): void {
        this.ledgers.register(this.ledger)
    }
}
