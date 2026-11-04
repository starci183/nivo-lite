import type { PackagePreviewView } from "@modules/domain/agent-templates"
import type { InstalledTemplate, TemplateVersionView, TemplateView, UpdateOffer } from "@nivo-lite/agent-sdk/template"
import type {
    CreatorLedgerView,
    FirstPartySyncReport,
    LikenessGrantView,
    ListingCardView,
    ListingView,
} from "@modules/domain/template-marketplace"
import type { PayableOrder } from "@modules/domain/billing"
import type { CreatorLedgerType } from "./dto/creator-ledger.type"
import type { FirstPartySyncReportType } from "./dto/first-party-sync-report.type"
import type { InstalledTemplateType } from "./dto/installed-template.type"
import type { LikenessGrantType } from "./dto/likeness-grant.type"
import type { ListingCardType } from "./dto/listing-card.type"
import type { ListingType } from "./dto/listing.type"
import type { PackagePreviewType } from "./dto/package-preview.type"
import type { TemplateOrderType } from "./dto/template-order.type"
import type { TemplateVersionType } from "./dto/template-version.type"
import type { TemplateType } from "./dto/template.type"
import type { UpdateOfferType } from "./dto/update-offer.type"

/** Maps the preview of packaging to its GraphQL type. */
export const toPackagePreviewType = (preview: PackagePreviewView): PackagePreviewType => ({ ...preview })

/** Maps a saved version to its GraphQL type. */
export const toTemplateVersionType = (version: TemplateVersionView): TemplateVersionType => ({ ...version })

/** Maps a template with its versions to its GraphQL type. */
export const toTemplateType = (template: TemplateView): TemplateType => ({
    id: template.id,
    key: template.key,
    baseModule: template.baseModule,
    name: template.name,
    versions: template.versions.map((version) => ({ ...version })),
})

/** Maps what an install made to its GraphQL type. */
export const toInstalledTemplateType = (installed: InstalledTemplate): InstalledTemplateType => ({ ...installed })

/** Maps a listing to its GraphQL type. */
export const toListingType = (listing: ListingView): ListingType => ({
    ...listing,
    checks: listing.checks.map((check) => ({ ...check })),
})

/** Maps a catalogue card to its GraphQL type. */
export const toListingCardType = (card: ListingCardView): ListingCardType => ({
    id: card.id,
    templateKey: card.templateKey,
    version: card.version,
    name: card.name,
    summary: card.summary,
    points: card.points.map((point) => ({ ...point })),
    category: card.category,
    publisherName: card.publisherName,
    firstParty: card.firstParty,
    priceVnd: card.priceVnd,
    parameters: card.parameters.map((parameter) => ({ ...parameter })),
    requiredProviders: [...card.requiredProviders],
    requiredAuthorityActions: [...card.requiredAuthorityActions],
    personName: card.personName,
})

/** Maps the order of a paid listing to its GraphQL type. */
export const toTemplateOrderType = (payable: PayableOrder): TemplateOrderType => ({
    orderId: payable.order.id,
    orderCode: payable.order.orderCode,
    amountVnd: payable.order.amountVnd,
    expiresAt: payable.order.expiresAt,
    qrUrl: payable.qrUrl,
    bank: payable.bank.bank,
    account: payable.bank.account,
    holder: payable.bank.holder,
})

/** Maps an offer of a newer version to its GraphQL type. */
export const toUpdateOfferType = (offer: UpdateOffer): UpdateOfferType => ({
    installationId: offer.installationId,
    key: offer.key,
    installed: offer.installed,
    offered: offer.offered,
    breaking: offer.breaking,
    changelog: offer.changelog,
    units: offer.units.map((unit) => ({ ...unit })),
})

/** Maps the ledger of a creator to its GraphQL type. */
export const toCreatorLedgerType = (ledger: CreatorLedgerView): CreatorLedgerType => ({
    lines: ledger.lines.map((line) => ({ ...line })),
    owedVnd: ledger.owedVnd,
})

/** Maps a consent record to its GraphQL type. */
export const toLikenessGrantType = (grant: LikenessGrantView): LikenessGrantType => ({
    ...grant,
    allowedUses: [...grant.allowedUses],
})

/** Maps the report of a sync of the first-party templates to its GraphQL type. */
export const toFirstPartySyncReportType = (report: FirstPartySyncReport): FirstPartySyncReportType => ({
    packaged: [...report.packaged],
    unchanged: [...report.unchanged],
    refused: [...report.refused],
    adopted: report.adopted,
})
