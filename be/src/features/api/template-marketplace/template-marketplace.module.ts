import { Module } from "@nestjs/common"
import { PreviewAgentTemplateHandler } from "./application/preview-agent-template.handler"
import { PackageAgentTemplateHandler } from "./application/package-agent-template.handler"
import { MyAgentTemplatesHandler } from "./application/my-agent-templates.handler"
import { ExportAgentTemplateHandler } from "./application/export-agent-template.handler"
import { ImportAgentTemplateHandler } from "./application/import-agent-template.handler"
import { SubmitTemplateListingHandler } from "./application/submit-template-listing.handler"
import { ReviewTemplateListingHandler } from "./application/review-template-listing.handler"
import { TemplateReviewQueueHandler } from "./application/template-review-queue.handler"
import { MyTemplateListingsHandler } from "./application/my-template-listings.handler"
import { MarketplaceListingsHandler } from "./application/marketplace-listings.handler"
import { InstallTemplateListingHandler } from "./application/install-template-listing.handler"
import { OrderTemplateListingHandler } from "./application/order-template-listing.handler"
import { TemplateUpdateOffersHandler } from "./application/template-update-offers.handler"
import { AcceptTemplateUpdateHandler } from "./application/accept-template-update.handler"
import { MyCreatorLedgerHandler } from "./application/my-creator-ledger.handler"
import { RecordTemplateLikenessHandler } from "./application/record-template-likeness.handler"
import { VerifyTemplateLikenessHandler } from "./application/verify-template-likeness.handler"
import { ForkFirstPartyTemplateHandler } from "./application/fork-first-party-template.handler"
import { SyncFirstPartyTemplatesHandler } from "./application/sync-first-party-templates.handler"
import { ConfigurableModuleClass } from "./template-marketplace.module-definition"

@Module({
    providers: [
        SyncFirstPartyTemplatesHandler,
        ForkFirstPartyTemplateHandler,
        PreviewAgentTemplateHandler,
        PackageAgentTemplateHandler,
        MyAgentTemplatesHandler,
        ExportAgentTemplateHandler,
        ImportAgentTemplateHandler,
        SubmitTemplateListingHandler,
        ReviewTemplateListingHandler,
        TemplateReviewQueueHandler,
        MyTemplateListingsHandler,
        MarketplaceListingsHandler,
        InstallTemplateListingHandler,
        OrderTemplateListingHandler,
        TemplateUpdateOffersHandler,
        AcceptTemplateUpdateHandler,
        MyCreatorLedgerHandler,
        RecordTemplateLikenessHandler,
        VerifyTemplateLikenessHandler,
    ],
})
/** The template-marketplace feature: the handlers of its application. */
export class TemplateMarketplaceApiModule extends ConfigurableModuleClass {}
