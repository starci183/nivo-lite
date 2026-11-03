import type { PackageRequest } from "@modules/domain/agent-templates"
import type {
    InstalledTemplate,
    PackagePreview,
    ParameterBinding,
    ParameterValue,
    ParameterValues,
    TemplateParameter,
    TemplateVersionView,
    TemplateView,
    UpdateOffer,
} from "@nivo-lite/agent-sdk/template"
import type {
    CreatorLedgerView,
    FirstPartySyncReport,
    LikenessGrantRequest,
    LikenessGrantView,
    ListingCard,
    ListingView,
} from "@modules/domain/template-marketplace"
import type { PayableOrder } from "@modules/domain/billing"
import { isRecord } from "@modules/platform/primitives"
import type { CreatorLedgerType } from "./dto/creator-ledger.type"
import type { FirstPartySyncReportType } from "./dto/first-party-sync-report.type"
import type { InstalledTemplateType } from "./dto/installed-template.type"
import type { LikenessGrantType } from "./dto/likeness-grant.type"
import type { ListingCardType } from "./dto/listing-card.type"
import type { ListingType } from "./dto/listing.type"
import type { PackageAgentTemplateInput } from "./dto/package-agent-template.input"
import type { PackagePreviewType } from "./dto/package-preview.type"
import type { RecordTemplateLikenessInput } from "./dto/record-template-likeness.input"
import type { TemplateOrderType } from "./dto/template-order.type"
import type { TemplateParameterInput } from "./dto/template-parameter.input"
import type { TemplateParameterType } from "./dto/template-parameter.type"
import type { TemplateVersionType } from "./dto/template-version.type"
import type { TemplateType } from "./dto/template.type"
import type { UpdateOfferType } from "./dto/update-offer.type"

const valueOfText = (kind: TemplateParameter["kind"], text: string): ParameterValue => {
    if (kind === "number") return Number(text)
    return kind === "toggle" ? text === "true" : text
}

const parameterOf = (input: TemplateParameterInput): TemplateParameter => {
    const kind = input.kind === "number" || input.kind === "toggle" || input.kind === "textarea" ? input.kind : "text"
    return {
        key: input.key,
        kind,
        label: input.label,
        hint: input.hint ?? null,
        min: input.min ?? null,
        max: input.max ?? null,
        required: input.required,
        default: valueOfText(kind, input.defaultValue),
    }
}

/** Maps the packaging input of a workspace to the request of the domain. */
export const toPackageRequest = (workspaceId: string, input: PackageAgentTemplateInput): PackageRequest => ({
    workspaceId,
    agentId: input.agentId,
    graphVersionId: input.graphVersionId,
    key: input.key,
    listing: { name: input.name, summary: input.summary, points: [], category: input.category },
    parameters: input.parameters.map((parameter) => parameterOf(parameter)),
    bindings: input.bindings.map((binding): ParameterBinding =>
        binding.target === "branch_timeout"
            ? {
                  parameter: binding.parameter,
                  target: "branch_timeout",
                  nodeKey: binding.nodeKey,
                  branchKey: binding.branchKey,
              }
            : {
                  parameter: binding.parameter,
                  target: "branch_value",
                  nodeKey: binding.nodeKey,
                  branchKey: binding.branchKey,
                  termIndex: binding.termIndex ?? 0,
              },
    ),
    starterDocumentIds: input.starterDocumentIds,
    persona: {
        soul: input.soul,
        likeness:
            input.likeness === undefined
                ? null
                : {
                      personName: input.likeness.personName,
                      allowedUses: input.likeness.allowedUses.flatMap((use) =>
                          use === "name" || use === "avatar" || use === "voice_style" || use === "first_person"
                              ? [use]
                              : [],
                      ),
                      disclosure: input.likeness.disclosure,
                  },
    },
    requiresPlugins: [],
    changelog: input.changelog,
    breaking: input.breaking,
})

/** The values of the buyer as the domain reads them: numbers, texts and yes or no, nothing else. */
export const valuesOf = (value: object): ParameterValues =>
    isRecord(value)
        ? Object.fromEntries(
              Object.entries(value).flatMap(([key, member]): Array<[string, ParameterValue]> =>
                  typeof member === "number" || typeof member === "string" || typeof member === "boolean"
                      ? [[key, member]]
                      : [],
              ),
          )
        : {}

/** Maps the consent input to the request of the domain. */
export const likenessRequestOf = (input: RecordTemplateLikenessInput): LikenessGrantRequest => ({
    templateKey: input.templateKey,
    personName: input.personName,
    allowedUses: input.allowedUses.flatMap((use) =>
        use === "name" || use === "avatar" || use === "voice_style" || use === "first_person" ? [use] : [],
    ),
    disclosure: input.disclosure,
    expiresAt: input.expiresAt === undefined ? null : new Date(input.expiresAt),
})

const parameterTypeOf = (parameter: TemplateParameter): TemplateParameterType => ({
    key: parameter.key,
    kind: parameter.kind,
    label: parameter.label,
    hint: parameter.hint,
    min: parameter.min,
    max: parameter.max,
    required: parameter.required,
    defaultValue: String(parameter.default),
})

/** Maps the preview of packaging to its GraphQL type. */
export const toPackagePreviewType = (preview: PackagePreview): PackagePreviewType => ({
    package:
        preview.package === null
            ? null
            : {
                  key: preview.package.key,
                  version: preview.package.version,
                  hash: preview.package.hash,
                  baseModule: preview.package.baseModule,
                  requiredProviders: [...preview.package.requiredProviders],
                  requiredAuthorityActions: [...preview.package.requiredAuthorityActions],
                  starterKnowledge: preview.package.starterKnowledge.length,
                  parameters: preview.package.parameters.map((parameter) => parameterTypeOf(parameter)),
                  proposedRights: preview.package.proposedRights.map((right) => ({
                      kind: right.kind,
                      scope: right.scope,
                  })),
                  personName: preview.package.persona.likeness?.personName ?? null,
              },
    report: preview.report,
    problems: [...preview.problems],
    suggestions: preview.suggestions.map((suggestion) => ({
        parameter: suggestion.parameter,
        target: suggestion.target,
        nodeKey: suggestion.nodeKey,
        branchKey: suggestion.branchKey,
        termIndex: suggestion.target === "branch_value" ? suggestion.termIndex : null,
    })),
})

/** Maps a saved version to its GraphQL type. */
export const toTemplateVersionType = (version: TemplateVersionView): TemplateVersionType => ({ ...version })

/** Maps a template with its versions to its GraphQL type. */
export const toTemplateType = (template: TemplateView): TemplateType => ({
    id: template.id,
    key: template.key,
    baseModule: template.baseModule,
    name: template.name,
    versions: template.versions.map((version) => toTemplateVersionType(version)),
})

/** Maps what an install made to its GraphQL type. */
export const toInstalledTemplateType = (installed: InstalledTemplate): InstalledTemplateType => ({ ...installed })

/** Maps a listing to its GraphQL type. */
export const toListingType = (listing: ListingView): ListingType => ({
    ...listing,
    checks: listing.checks.map((check) => ({ ...check })),
})

/** Maps a catalogue card to its GraphQL type. */
export const toListingCardType = (card: ListingCard): ListingCardType => ({
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
    parameters: card.parameters.map((parameter) => parameterTypeOf(parameter)),
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
