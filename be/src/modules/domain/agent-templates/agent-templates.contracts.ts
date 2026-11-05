/** The contracts of the agent templates are the SDK's: the package format, parameters, provenance, installs and update offers. */
import type {
    PackageReport,
    ParameterBinding,
    ParameterOption,
    ParameterValue,
    ParameterValues,
    RequiredPlugin,
    TemplateListingText,
    TemplateParameter,
    TemplatePersona,
    TemplateText,
} from "@nivo-lite/agent-sdk/template"

export { MAX_PARAMETERS, TEMPLATE_FORMAT, TEMPLATE_KEY_PATTERN } from "@nivo-lite/agent-sdk/template"
export type {
    AgentTemplatePackage,
    InstalledTemplate,
    LikenessClaim,
    PackageDraft,
    PackagePreview,
    PackageReport,
    ParameterBinding,
    ParameterValue,
    ParameterValues,
    RequiredPlugin,
    StarterKnowledge,
    TemplateListingText,
    TemplateParameter,
    TemplatePersona,
    TemplatePublisher,
    TemplateText,
    TemplateVersionView,
    TemplateView,
    UpdateOffer,
    UpdateUnit,
    UnitChange,
} from "@nivo-lite/agent-sdk/template"

/** What the creator gives to package one version of an agent. */
export interface PackageRequest {
    /** The workspace of the creator. */
    readonly workspaceId: string
    /** The agent. */
    readonly agentId: string
    /** The frozen graph version to package. */
    readonly graphVersionId: string
    /** The key of the template. */
    readonly key: string
    /** The card. */
    readonly listing: TemplateListingText
    /** The settings of the buyer. */
    readonly parameters: ReadonlyArray<TemplateParameter>
    /** Where they land. */
    readonly bindings: ReadonlyArray<ParameterBinding>
    /** The published public documents to start the buyer with. */
    readonly starterDocumentIds: ReadonlyArray<string>
    /** The voice and the person. */
    readonly persona: TemplatePersona
    /** The plug-ins the graph needs. */
    readonly requiresPlugins: ReadonlyArray<RequiredPlugin>
    /** What changed. */
    readonly changelog: string
    /** True when the buyer must read it before taking it. */
    readonly breaking: boolean
}

/** What of a real person a persona may use. */
export type LikenessUse = "name" | "avatar" | "voice_style" | "first_person"

/** The values of the settings of a template by key: numbers, texts and yes or no. */
export interface ParameterValueMap {
    readonly [key: string]: ParameterValue
}

/** The real person a persona is modelled on, as the creator types it. */
export interface LikenessInput {
    /** The person. */
    readonly personName: string
    /** What of them the agent may use. */
    readonly allowedUses: ReadonlyArray<LikenessUse>
    /** The line shown to every customer. */
    readonly disclosure: string
}

/** One setting as the creator types it: the default is a text, the optional parts may be absent. */
export interface ParameterInput {
    /** The key. */
    readonly key: string
    /** How the value is entered. */
    readonly kind: "number" | "text" | "toggle" | "textarea" | "time" | "choice"
    /** The label. */
    readonly label: TemplateText
    /** A line of help. */
    readonly hint?: TemplateText
    /** The smallest number. */
    readonly min?: number
    /** The biggest number. */
    readonly max?: number
    /** True when the buyer must fill it. */
    readonly required: boolean
    /** The default value as text (a number, a text or `true`/`false`). */
    readonly defaultValue: string
    /** The choices of a `choice` setting. */
    readonly options?: ReadonlyArray<ParameterOption> | undefined
}

/** Where a parameter lands, as the creator types it: a value names its term, a wait does not. */
export interface BindingInput {
    /** The parameter key. */
    readonly parameter: string
    /** A value a condition compares with, or a wait. */
    readonly target: "branch_value" | "branch_timeout"
    /** The node. */
    readonly nodeKey: string
    /** The branch. */
    readonly branchKey: string
    /** Which term of the condition, for a value; the first when absent. */
    readonly termIndex?: number
}

/** The version of an agent to package, as the creator types it into the editor. */
export interface PackageInput {
    /** The agent. */
    readonly agentId: string
    /** The frozen graph version to package. */
    readonly graphVersionId: string
    /** The key of the template. */
    readonly key: string
    /** The name on the card. */
    readonly name: TemplateText
    /** The summary. */
    readonly summary: TemplateText
    /** The category key. */
    readonly category: string
    /** The settings of the buyer. */
    readonly parameters: ReadonlyArray<ParameterInput>
    /** Where they land in the graph. */
    readonly bindings: ReadonlyArray<BindingInput>
    /** The published public documents to start the buyer with. */
    readonly starterDocumentIds: ReadonlyArray<string>
    /** The voice of the agent. */
    readonly soul: string
    /** The real person the persona is modelled on, when it is one. */
    readonly likeness?: LikenessInput
    /** What changed. */
    readonly changelog: string
    /** True when the buyer must read the version before taking it. */
    readonly breaking: boolean
}

/** One setting the way the editor shows it: the default as text. */
export interface ParameterView {
    /** The key. */
    readonly key: string
    /** How the value is entered. */
    readonly kind: "number" | "text" | "toggle" | "textarea" | "time" | "choice"
    /** The label. */
    readonly label: TemplateText
    /** A line of help. */
    readonly hint: TemplateText | null
    /** The smallest number. */
    readonly min: number | null
    /** The biggest number. */
    readonly max: number | null
    /** True when the buyer must fill it. */
    readonly required: boolean
    /** The default value as text (a number, a text or `true`/`false`). */
    readonly defaultValue: string
    /** The choices of a `choice` setting; null for every other kind. */
    readonly options: ReadonlyArray<ParameterOption> | null
}

/** A data right a package proposes. */
export interface RightView {
    /** The kind of data. */
    readonly kind: string
    /** `conversation` or `workspace`. */
    readonly scope: string
}

/** A number of the graph a creator could turn into a parameter. */
export interface SuggestionView {
    /** A key to propose. */
    readonly parameter: string
    /** A value a condition compares with, or a wait. */
    readonly target: string
    /** The node. */
    readonly nodeKey: string
    /** The branch. */
    readonly branchKey: string
    /** Which term of the condition, for a value, or null. */
    readonly termIndex: number | null
}

/** What a package holds, for the preview. */
export interface PackageSummaryView {
    /** The key. */
    readonly key: string
    /** The version it would be saved as. */
    readonly version: number
    /** The hash of the package. */
    readonly hash: string
    /** The module it stands on. */
    readonly baseModule: string
    /** The providers the buyer must connect. */
    readonly requiredProviders: Array<string>
    /** The actions that need a rule in the buyer's authority matrix. */
    readonly requiredAuthorityActions: Array<string>
    /** How many public documents the buyer starts with. */
    readonly starterKnowledge: number
    /** The settings of the buyer. */
    readonly parameters: Array<ParameterView>
    /** The rights proposed. */
    readonly proposedRights: Array<RightView>
    /** The real person the persona is modelled on, or null. */
    readonly personName: string | null
}

/** What packaging a version would keep and leave out, as the editor reads it. */
export interface PackagePreviewView {
    /** The package, or null when a problem refuses it. */
    readonly package: PackageSummaryView | null
    /** What was kept and what was left out. */
    readonly report: PackageReport
    /** Why packaging is refused. */
    readonly problems: Array<string>
    /** Numbers of the graph that could become parameters. */
    readonly suggestions: Array<SuggestionView>
}

/** The right of a workspace to run a template, as the marketplace reads it. */
export interface TemplateLicenseView {
    /** The license. */
    readonly id: string
    /** How the right was got. */
    readonly kind: "private" | "free" | "paid"
    /** The installation that runs on it, or null while it waits for an install. */
    readonly installationId: string | null
    /** The status. */
    readonly status: "pending" | "active" | "expired" | "revoked"
}

/** A license, or null when there is none. */
export type OptionalTemplateLicenseView = TemplateLicenseView | null

/** What an installation took from a template, as the marketplace reads it. */
export interface TemplateInstallView {
    /** The installation. */
    readonly installationId: string
    /** The workspace. */
    readonly workspaceId: string
    /** The template key. */
    readonly templateKey: string
    /** The version installed. */
    readonly version: number
    /** The values the buyer gave, by parameter key. */
    readonly parameterValues: Readonly<Record<string, number | string | boolean>>
    /** The license, or null. */
    readonly licenseId: string | null
}

/** An install, or null when there is none. */
export type OptionalTemplateInstallView = TemplateInstallView | null

/** Where an install moves to: a newer version and the values it now holds. */
export interface MoveInstallInput {
    /** The installation. */
    readonly installationId: string
    /** The version it moves to. */
    readonly version: number
    /** The values it now holds, by parameter key. */
    readonly parameterValues: ParameterValues
}

/** The paid license a settled order writes. */
export interface PaidLicenseGrant {
    /** The workspace that paid. */
    readonly workspaceId: string
    /** The template key. */
    readonly templateKey: string
    /** The listing bought. */
    readonly listingId: string
    /** The order that paid. */
    readonly orderId: string
}

/** The installation of a built-in module that a free license and an install row are recorded for. */
export interface AdoptedInstallation {
    /** The installation. */
    readonly id: string
    /** The workspace. */
    readonly workspaceId: string
}
