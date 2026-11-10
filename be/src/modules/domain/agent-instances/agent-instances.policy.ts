import { AGENT_IDENTITY_RULES } from "@modules/domain/agents"
import { isChannelPurpose } from "@modules/domain/agent-connections"
import type { Purpose } from "@modules/domain/agent-connections"
import { AgentInstancesErrorCode } from "./errors/agent-instances.error"
import type {
    AvatarChoice,
    ChannelChoice,
    ChannelChoiceOwner,
    CopiedGrant,
    CreateAgentInstanceRequest,
    JudgedAgentRequest,
} from "./agent-instances.contracts"

/** A request that holds, or why it does not. */
export type Judged =
    | { readonly kind: "ok"; readonly value: JudgedAgentRequest }
    | {
          readonly kind: "refused"
          readonly code: AgentInstancesErrorCode
          readonly params: Readonly<Record<string, string | number>>
      }

/** The picture a request asks for: an uploaded path wins over a preset; neither is none (the default sprout). */
const avatarOf = (request: Pick<CreateAgentInstanceRequest, "avatarPreset" | "avatarPath">): AvatarChoice => {
    if (request.avatarPath !== null && request.avatarPath !== "") return { kind: "upload", path: request.avatarPath }
    if (request.avatarPreset !== null && request.avatarPreset !== "") {
        return { kind: "preset", preset: request.avatarPreset }
    }
    return null
}

/** The sibling a request copies the setup of, or null for the default setup. */
export const copySourceIdOf = (request: Pick<CreateAgentInstanceRequest, "startFrom" | "copyFrom">): string | null =>
    request.startFrom === "copy" ? request.copyFrom : null

/**
 * Checks what the owner typed for a new agent: a display name within its limits, a handle (when typed) that cleans into one, and a
 * picture that is a preset an agent may wear or an uploaded path.
 */
export const judgeRequest = (
    request: Pick<CreateAgentInstanceRequest, "name" | "handle" | "avatarPreset" | "avatarPath">,
): Judged => {
    const avatar = avatarOf(request)
    const name = AGENT_IDENTITY_RULES.cleanName(request.name)
    if (name === null)
        return {
            kind: "refused",
            code: AgentInstancesErrorCode.NameInvalid,
            params: { ...AGENT_IDENTITY_RULES.nameLimits },
        }
    const typedHandle = request.handle === null || request.handle.trim() === "" ? null : request.handle
    const handle = typedHandle === null ? null : AGENT_IDENTITY_RULES.cleanHandle(typedHandle)
    if (typedHandle !== null && handle === null) {
        return {
            kind: "refused",
            code: AgentInstancesErrorCode.HandleInvalid,
            params: { ...AGENT_IDENTITY_RULES.handleLimits },
        }
    }
    if (avatar?.kind === "preset" && !AGENT_IDENTITY_RULES.isAvatarPreset(avatar.preset)) {
        return {
            kind: "refused",
            code: AgentInstancesErrorCode.AvatarPresetInvalid,
            params: { preset: avatar.preset },
        }
    }
    return { kind: "ok", value: { name, handle, avatar } }
}

/** A connection of the workspace as the channel choices read it. */
export interface ChannelSource {
    /** The connection. */
    readonly id: string
    /** Its display name. */
    readonly name: string
    /** The provider. */
    readonly provider: string
    /** connected, error, pending or disconnected. */
    readonly status: string
    /** The bot username, or null. */
    readonly botUsername: string | null
}

/** The channel a request names that cannot be given: not a choice of the role, or answered by another agent of the role. */
export type ChannelProblem =
    | { readonly kind: "unavailable"; readonly connectionId: string }
    | { readonly kind: "owned"; readonly connectionId: string; readonly agentName: string }
    | null

/**
 * The channel connections an agent of a role could answer: the connections whose provider the role speaks on for a channel purpose,
 * not disconnected, each with the agent of the role that answers it already.
 */
export const channelChoicesOf = (
    connections: ReadonlyArray<ChannelSource>,
    purposeOf: (provider: string) => Purpose | null,
    ownerOf: (connectionId: string) => ChannelChoiceOwner,
): ReadonlyArray<ChannelChoice> =>
    connections.flatMap((connection): ReadonlyArray<ChannelChoice> => {
        const purpose = purposeOf(connection.provider)
        if (purpose === null || !isChannelPurpose(purpose) || connection.status === "disconnected") return []
        return [
            {
                connectionId: connection.id,
                name: connection.name,
                provider: connection.provider,
                botUsername: connection.botUsername,
                status: connection.status,
                purpose,
                ...ownerOf(connection.id),
            },
        ]
    })

/** The first chosen channel that cannot be given to the new agent, or null when all of them can. */
export const channelProblemOf = (
    choices: ReadonlyArray<ChannelChoice>,
    wanted: ReadonlyArray<string>,
): ChannelProblem => {
    for (const connectionId of wanted) {
        const choice = choices.find((entry) => entry.connectionId === connectionId)
        if (choice === undefined) return { kind: "unavailable", connectionId }
        if (choice.ownerAgentName !== null) return { kind: "owned", connectionId, agentName: choice.ownerAgentName }
    }
    return null
}

/** A connection a sibling uses, as the copy reads it. */
export interface SiblingGrant {
    /** The connection. */
    readonly id: string
    /** What the role uses it for. */
    readonly purpose: string
    /** Whether the sibling is bound to it. */
    readonly bound: boolean
}

/**
 * The connections a copy binds the new agent to like its sibling: the shared ones (data sources, tools, bank feeds). A channel never comes over: it is owned by the sibling, and each channel has one agent per role.
 */
export const copiedGrantsOf = (sibling: ReadonlyArray<SiblingGrant>): ReadonlyArray<CopiedGrant> =>
    sibling.flatMap((grant): ReadonlyArray<CopiedGrant> =>
        !grant.bound || isChannelPurpose(grant.purpose) ? [] : [{ connectionId: grant.id }],
    )
