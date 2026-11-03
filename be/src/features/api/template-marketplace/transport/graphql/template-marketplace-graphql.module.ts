import { Module } from "@nestjs/common"
import { TemplateMarketplaceApiModule } from "../../template-marketplace.module"
import { PreviewAgentTemplateResolver } from "./preview-agent-template.resolver"
import { PackageAgentTemplateResolver } from "./package-agent-template.resolver"
import { MyAgentTemplatesResolver } from "./my-agent-templates.resolver"
import { ExportAgentTemplateResolver } from "./export-agent-template.resolver"
import { ImportAgentTemplateResolver } from "./import-agent-template.resolver"
import { SubmitTemplateListingResolver } from "./submit-template-listing.resolver"
import { ReviewTemplateListingResolver } from "./review-template-listing.resolver"
import { TemplateReviewQueueResolver } from "./template-review-queue.resolver"
import { MyTemplateListingsResolver } from "./my-template-listings.resolver"
import { MarketplaceListingsResolver } from "./marketplace-listings.resolver"
import { InstallTemplateListingResolver } from "./install-template-listing.resolver"
import { OrderTemplateListingResolver } from "./order-template-listing.resolver"
import { TemplateUpdateOffersResolver } from "./template-update-offers.resolver"
import { AcceptTemplateUpdateResolver } from "./accept-template-update.resolver"
import { MyCreatorLedgerResolver } from "./my-creator-ledger.resolver"
import { RecordTemplateLikenessResolver } from "./record-template-likeness.resolver"
import { VerifyTemplateLikenessResolver } from "./verify-template-likeness.resolver"
import { ForkFirstPartyTemplateResolver } from "./fork-first-party-template.resolver"
import { SyncFirstPartyTemplatesResolver } from "./sync-first-party-templates.resolver"
import { ConfigurableModuleClass } from "./template-marketplace-graphql.module-definition"

@Module({
    imports: [TemplateMarketplaceApiModule.register({})],
    providers: [
        SyncFirstPartyTemplatesResolver,
        ForkFirstPartyTemplateResolver,
        PreviewAgentTemplateResolver,
        PackageAgentTemplateResolver,
        MyAgentTemplatesResolver,
        ExportAgentTemplateResolver,
        ImportAgentTemplateResolver,
        SubmitTemplateListingResolver,
        ReviewTemplateListingResolver,
        TemplateReviewQueueResolver,
        MyTemplateListingsResolver,
        MarketplaceListingsResolver,
        InstallTemplateListingResolver,
        OrderTemplateListingResolver,
        TemplateUpdateOffersResolver,
        AcceptTemplateUpdateResolver,
        MyCreatorLedgerResolver,
        RecordTemplateLikenessResolver,
        VerifyTemplateLikenessResolver,
    ],
})
/** The GraphQL transport of the template-marketplace feature. */
export class TemplateMarketplaceGraphqlModule extends ConfigurableModuleClass {}
