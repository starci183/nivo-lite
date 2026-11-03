import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { PAID_ORDER_FULFILMENT } from "@modules/domain/sepay-transactions"
import { CreatorLedgerService } from "./creator-ledger.service"
import { FirstPartyTemplatesService } from "./first-party-templates.service"
import { TemplateLikenessService } from "./template-likeness.service"
import { TemplateListingsService } from "./template-listings.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./template-marketplace.module-definition"
import { TemplatePaymentsService } from "./template-payments.service"
import { TemplatePurchasesService } from "./template-purchases.service"
import { TemplateUpdatesService } from "./template-updates.service"

@Module({})
/**
 * The marketplace of agent templates: listings with a review, the consent of a real person to a persona, buying through the payment
 * rails of the product, the license each install holds, the updates offered to buyers and the ledger of what creators are owed.
 */
export class TemplateMarketplaceModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        const services = [
            CreatorLedgerService,
            FirstPartyTemplatesService,
            TemplateLikenessService,
            TemplateListingsService,
            TemplatePaymentsService,
            TemplatePurchasesService,
            TemplateUpdatesService,
        ]
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                ...services,
                { provide: PAID_ORDER_FULFILMENT, useExisting: TemplatePaymentsService },
            ],
            exports: [...services, PAID_ORDER_FULFILMENT],
        }
    }
}
