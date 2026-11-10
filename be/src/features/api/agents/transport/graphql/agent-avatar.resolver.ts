import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { RequestAgentAvatarUploadCommand } from "../../application/request-agent-avatar-upload.command"
import { SetAgentAvatarCommand } from "../../application/set-agent-avatar.command"
import { SetAgentAvatarPresetCommand } from "../../application/set-agent-avatar-preset.command"
import {
    toAgentAvatarUploadType,
    toRequestAgentAvatarUploadRequest,
    toSetAgentAvatarPresetRequest,
    toSetAgentAvatarRequest,
} from "./agent-avatar.mapper"
import { toAgentAckType } from "./agents.mapper"
import { AgentAckType } from "./dto/agent-ack.type"
import { AgentAvatarUploadType } from "./dto/agent-avatar-upload.type"
import { RequestAgentAvatarUploadInput } from "./dto/request-agent-avatar-upload.input"
import { SetAgentAvatarInput } from "./dto/set-agent-avatar.input"
import { SetAgentAvatarPresetInput } from "./dto/set-agent-avatar-preset.input"

@Resolver()
/** GraphQL doors of an agent picture: the upload address, then setting or removing it. Managers only. */
export class AgentAvatarResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** A one-time address the browser PUTs an agent picture to (PNG, JPEG or WebP, at most 2 MB). */
    @Mutation(() => AgentAvatarUploadType, { name: "requestAgentAvatarUpload" })
    async requestAgentAvatarUpload(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: RequestAgentAvatarUploadInput,
    ): Promise<AgentAvatarUploadType> {
        const upload = await this.commandBus.execute(
            new RequestAgentAvatarUploadCommand({
                request: toRequestAgentAvatarUploadRequest(workspaceId, input),
                principal,
            }),
        )
        return toAgentAvatarUploadType(upload)
    }

    /** Sets the uploaded picture on an agent; a null path removes it (back to the generated avatar). */
    @Mutation(() => AgentAckType, { name: "setAgentAvatar" })
    async setAgentAvatar(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SetAgentAvatarInput,
    ): Promise<AgentAckType> {
        await this.commandBus.execute(
            new SetAgentAvatarCommand({ request: toSetAgentAvatarRequest(workspaceId, input), principal }),
        )
        return toAgentAckType()
    }

    /** Dresses an agent in a preset picture (dropping any uploaded one); a null preset goes back to the default sprout. */
    @Mutation(() => AgentAckType, { name: "setAgentAvatarPreset" })
    async setAgentAvatarPreset(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SetAgentAvatarPresetInput,
    ): Promise<AgentAckType> {
        await this.commandBus.execute(
            new SetAgentAvatarPresetCommand({ request: toSetAgentAvatarPresetRequest(workspaceId, input), principal }),
        )
        return toAgentAckType()
    }
}
