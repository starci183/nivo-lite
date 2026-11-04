import type { TEMPLATE_FORMAT } from "./format"
import type { GraphDocument, GraphRight } from "./graph.types"

/** A text in both product languages. */
export interface TemplateText {
    /** The Vietnamese text. */
    readonly vi: string
    /** The English text. */
    readonly en: string
}

/** What the card of the package says. */
export interface TemplateListingText {
    /** The name. */
    readonly name: TemplateText
    /** The one-sentence summary. */
    readonly summary: TemplateText
    /** The selling points. */
    readonly points: ReadonlyArray<TemplateText>
    /** The category key of the catalogue. */
    readonly category: string
}

/** A value a parameter can hold. */
export type ParameterValue = number | string | boolean

/** One setting the buyer fills in, after the SettingDefinition of an automation template. */
export interface TemplateParameter {
    /** The key; a `{{key}}` in a text of the graph is replaced by the value. */
    readonly key: string
    /** How the value is entered. */
    readonly kind: "number" | "text" | "toggle" | "textarea"
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
    /** The value when the buyer gives none. */
    readonly default: ParameterValue
}

/** Which number of the graph a parameter sets: only a value a condition compares with, or a wait; never what a branch does. */
export type ParameterBinding =
    | {
          readonly parameter: string
          readonly target: "branch_value"
          readonly nodeKey: string
          readonly branchKey: string
          /** Which term of the condition, counting its leaves from zero. */
          readonly termIndex: number
      }
    | {
          readonly parameter: string
          readonly target: "branch_timeout"
          readonly nodeKey: string
          readonly branchKey: string
      }

/** A public document the package starts the buyer with: written for customers, approved again by the buyer before it is published. */
export interface StarterKnowledge {
    /** The title. */
    readonly title: string
    /** The text. */
    readonly body: string
}

/** The consent of a real person to a persona: what the agent may use of them. */
export interface LikenessClaim {
    /** The person. */
    readonly personName: string
    /** What of them the agent may use. */
    readonly allowedUses: ReadonlyArray<"name" | "avatar" | "voice_style" | "first_person">
    /** The line shown to every customer. */
    readonly disclosure: string
}

/** The voice of the agent, and the real person it is modelled on, if any. */
export interface TemplatePersona {
    /** The voice, as the SOUL of the agent. */
    readonly soul: string
    /** The real person, or null for a neutral assistant. */
    readonly likeness: LikenessClaim | null
}

/** A plug-in the graph needs: its intents are code, so a package names them and never carries them. */
export interface RequiredPlugin {
    /** The key of the manifest. */
    readonly key: string
    /** The oldest version of it that works. */
    readonly minVersion: number
}

/** Who made the package. */
export interface TemplatePublisher {
    /** The account of the creator. */
    readonly creatorId: string
    /** The name shown on the card. */
    readonly displayName: string
}

/** The package of an agent's process: data only, no code, no secret and nothing of the creator's own business. */
export interface AgentTemplatePackage {
    /** The format. */
    readonly format: typeof TEMPLATE_FORMAT
    /** The key, unique across the marketplace. */
    readonly key: string
    /** The version, immutable once packaged. */
    readonly version: number
    /** Who made it. */
    readonly publisher: TemplatePublisher
    /** The module of the catalogue it stands on. */
    readonly baseModule: string
    /** The plug-ins its graph needs. */
    readonly requiresPlugins: ReadonlyArray<RequiredPlugin>
    /** The card. */
    readonly listing: TemplateListingText
    /** The process: nodes and the business half of the contracts; its own rights are always empty. */
    readonly graph: GraphDocument
    /** The settings of the buyer. */
    readonly parameters: ReadonlyArray<TemplateParameter>
    /** Where each number setting lands in the graph. */
    readonly bindings: ReadonlyArray<ParameterBinding>
    /** The rights the creator proposes; the buyer turns each one on, none is ever granted by the package. */
    readonly proposedRights: ReadonlyArray<GraphRight>
    /** The providers the agent needs connected; no credential travels. */
    readonly requiredProviders: ReadonlyArray<string>
    /** The actions of the authority matrix the buyer needs a rule for; the package carries no limit. */
    readonly requiredAuthorityActions: ReadonlyArray<string>
    /** The public documents the buyer starts with. */
    readonly starterKnowledge: ReadonlyArray<StarterKnowledge>
    /** The voice and the person. */
    readonly persona: TemplatePersona
    /** The hash of every field above. */
    readonly hash: string
}

/** What the creator gives to package a version. */
export interface PackageDraft {
    /** The key. */
    readonly key: string
    /** The version. */
    readonly version: number
    /** Who makes it. */
    readonly publisher: TemplatePublisher
    /** The module the agent stands on. */
    readonly baseModule: string
    /** The plug-ins the graph needs. */
    readonly requiresPlugins: ReadonlyArray<RequiredPlugin>
    /** The card. */
    readonly listing: TemplateListingText
    /** The settings. */
    readonly parameters: ReadonlyArray<TemplateParameter>
    /** Where they land. */
    readonly bindings: ReadonlyArray<ParameterBinding>
    /** The public documents to start with. */
    readonly starterKnowledge: ReadonlyArray<StarterKnowledge>
    /** The voice and the person. */
    readonly persona: TemplatePersona
    /** Ids that belong to the creator's workspace and must not appear anywhere in the package. */
    readonly forbidden: ReadonlyArray<string>
}

/** What the packager kept and what it left out, counted, for the preview. */
export interface PackageReport {
    /** Nodes kept. */
    readonly nodes: number
    /** Branches kept. */
    readonly branches: number
    /** References to the creator's Brain removed from the nodes. */
    readonly brainRefs: number
    /** Sources that were customer chats, learned proposals or people removed. */
    readonly privateSources: number
    /** Members and rooms removed from approvers. */
    readonly people: number
    /** Data rights not carried, kept as proposals. */
    readonly rights: number
}

/** The preview of packaging, or why it is refused. */
export interface PackagePreview {
    /** The package, or null when a problem refuses it. */
    readonly package: AgentTemplatePackage | null
    /** What was kept and what was left out. */
    readonly report: PackageReport
    /** Why packaging is refused: a path in the package and a reason. */
    readonly problems: ReadonlyArray<string>
    /** Numbers of the graph a creator could turn into parameters. */
    readonly suggestions: ReadonlyArray<ParameterBinding>
}

/** One saved version of a template as the creator and the catalogue read it. */
export interface TemplateVersionView {
    /** The id. */
    readonly id: string
    /** The template key. */
    readonly key: string
    /** The version. */
    readonly version: number
    /** The hash. */
    readonly hash: string
    /** The changelog. */
    readonly changelog: string
    /** True when the buyer must read it before taking it. */
    readonly breaking: boolean
    /** When it was packaged, ISO 8601. */
    readonly createdAt: string
}

/** A template of an account with its versions. */
export interface TemplateView {
    /** The id. */
    readonly id: string
    /** The key. */
    readonly key: string
    /** The module it stands on. */
    readonly baseModule: string
    /** The name. */
    readonly name: TemplateText
    /** The versions, newest first. */
    readonly versions: ReadonlyArray<TemplateVersionView>
}

/** What installing a package made. */
export interface InstalledTemplate {
    /** The installation. */
    readonly installationId: string
    /** The agent. */
    readonly agentId: string
    /** The template key. */
    readonly key: string
    /** The version installed. */
    readonly version: number
    /** The license record of the install. */
    readonly licenseId: string
}

/** What happens to one unit of a graph between versions. */
export type UnitChange = "upgrade" | "conflict" | "added" | "removed"

/** One branch or node the new version changes, and what the buyer did to it. */
export interface UpdateUnit {
    /** The id the buyer accepts it by: `node:<key>` or `branch:<node>:<branch>`. */
    readonly id: string
    /** The node. */
    readonly nodeKey: string
    /** The branch, or null for a node. */
    readonly branchKey: string | null
    /** What changes. */
    readonly change: UnitChange
}

/** The offer of a newer version to an installation. */
export interface UpdateOffer {
    /** The installation. */
    readonly installationId: string
    /** The template. */
    readonly key: string
    /** The version installed. */
    readonly installed: number
    /** The newer version. */
    readonly offered: number
    /** True when the buyer must read it. */
    readonly breaking: boolean
    /** The changelog. */
    readonly changelog: string
    /** The units that change; an upgrade is one the buyer never touched. */
    readonly units: ReadonlyArray<UpdateUnit>
}
