import type { Access, Purpose } from "@modules/domain/agent-connections"
import type { Locale } from "@modules/platform/i18n"
import type { WorkspaceRole } from "@modules/domain/workspace-members"

/** The picture a new agent starts with: a preset, an uploaded file (its object path), or none (the default sprout Grammar draws from the name). */
export type AvatarChoice =
    { readonly kind: "preset"; readonly preset: string } | { readonly kind: "upload"; readonly path: string } | null

/** What creating one more agent of a role takes (the create dialog of the agents page). */
export interface CreateAgentInstanceRequest {
    /** The workspace. */
    readonly workspaceId: string
    /** The role (module key). */
    readonly moduleKey: string
    /** The language of the generated texts. */
    readonly locale: Locale
    /** The name the customers see. */
    readonly name: string
    /** The @handle as typed; null to make one from the name. */
    readonly handle: string | null
    /** A preset picture; null or empty for none. */
    readonly avatarPreset: string | null
    /** The object path of an uploaded picture; it wins over a preset. */
    readonly avatarPath: string | null
    /** The channel connections the new agent answers; each must be free for the role. */
    readonly connectionIds: ReadonlyArray<string>
    /** Where the setup starts: a copy of `copyFrom`, or the default setup. */
    readonly startFrom: "copy" | "default"
    /** The installation of the same role to copy the setup of, when the setup starts from a copy. */
    readonly copyFrom: string | null
}

/** What a request asks for once it is checked: the cleaned name and handle, and the picture. */
export interface JudgedAgentRequest {
    /** The cleaned display name. */
    readonly name: string
    /** The cleaned @handle; null to make one from the name. */
    readonly handle: string | null
    /** The picture. */
    readonly avatar: AvatarChoice
}

/** How the graph of the sibling came over: copied, refused by the checks (the seed stays), or there was none to copy. */
export type GraphCopy = "copied" | "refused" | "none"

/** What the copy of the instance-only knowledge (the "Chi cho <agent>" layer) did. */
export interface KnowledgeCopy {
    /** Approved facts (and scheduled ones) copied as the new agent's own private facts. */
    readonly knowledgeFacts: number
    /** Documents copied as the new agent's own private documents. */
    readonly knowledgeDocuments: number
    /** Facts still waiting for approval: left with the source, never copied as approved. */
    readonly knowledgeWaiting: number
    /** Documents that could not be copied (quota, not readable). */
    readonly knowledgeSkipped: number
}

/** What "copy the setup of" carried over to the new agent. */
export interface CopiedSetup extends KnowledgeCopy {
    /** The installation the setup came from. */
    readonly fromInstallationId: string
    /** The settings and the operating mode. */
    readonly settings: boolean
    /** The applied setup (context) version. */
    readonly contextVersion: boolean
    /** The permission rules that now list the new agent too. */
    readonly rules: number
    /** The graph version. */
    readonly graph: GraphCopy
    /** The shared connections (data sources, tools) granted like the sibling's; channels never come over. */
    readonly connections: number
}

/** What creating an agent answers. */
export interface CreatedAgent {
    /** The new installation. */
    readonly installationId: string
    /** Its agent. */
    readonly agentId: string
    /** What the copy carried over; null for the default setup. */
    readonly copied: CopiedSetup | null
    /** The channels the agent now answers. */
    readonly channels: number
}

/** The agent of the role that answers a channel already. */
export interface ChannelChoiceOwner {
    /** The agent; null when the channel is free. */
    readonly ownerAgentId: string | null
    /** Its display name ("<name> is answering"); null when the channel is free. */
    readonly ownerAgentName: string | null
}

/** One channel connection a new agent of a role could answer, with the agent of that role that answers it already, if any. */
export interface ChannelChoice extends ChannelChoiceOwner {
    /** The connection. */
    readonly connectionId: string
    /** Its display name. */
    readonly name: string
    /** The provider (telegram, zalo_oa, meta). */
    readonly provider: string
    /** The bot username, when the provider has one. */
    readonly botUsername: string | null
    /** connected, error, pending. */
    readonly status: string
    /** What an agent of the role uses it for. */
    readonly purpose: Purpose
}

/** One shared connection a copy grants the new agent like its sibling. */
export interface CopiedGrant {
    /** The connection. */
    readonly connectionId: string
    /** The level the sibling has. */
    readonly access: Access
}

/** Who publishes the copied graph. */
export interface CopyPublisher {
    /** The account that copies: it adds the documents. */
    readonly userId: string
    /** The member id. */
    readonly memberId: string
    /** Their role: a copy that widens what the agent may do needs the owner. */
    readonly role: WorkspaceRole
}

/** The agent that answers a conversation's channel for a role, or null when none does. */
export type OptionalOwnerAgentId = string | null
