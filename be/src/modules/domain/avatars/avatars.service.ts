import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { AgentIdentityService } from "@modules/domain/agents"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { StorageObjectsPort } from "@modules/integrations/object-storage"
import { callDbFunction, InjectPrimaryEntityManager } from "@modules/platform/database"
import type { AvatarAccounts, AvatarFile, AvatarOwner, AvatarUpload, OptionalAvatarPath } from "./avatars.contracts"
import { InjectAvatarsAccounts, InjectAvatarsStorage } from "./avatars.decorators"
import { AVATAR_BUCKET, avatarExtensionOf, avatarPathOf, isAvatarPath, isHttpsAddress } from "./avatars.policy"
import { AvatarsError, AvatarsErrorCode } from "./errors/avatars.error"

/** The one row `gen_random_uuid()` answers: the new picture object name. */
interface AllocatedId {
    readonly gen_random_uuid: string
}

const GOVERNORS = ["owner", "manager"] as const

@Injectable()
/**
 * The pictures of people and agents. A browser uploads straight to Storage through a one-time address issued here (the bucket
 * itself holds the type and size limits), then hands the path back to set the picture; only an HTTPS public address is kept.
 * A person sets their own picture; an agent's picture is a manager's edit, like its name.
 */
export class AvatarsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectAvatarsStorage() private readonly storage: StorageObjectsPort,
        @InjectAvatarsAccounts() private readonly accounts: AvatarAccounts,
        private readonly members: WorkspaceMembersService,
        private readonly identity: AgentIdentityService,
    ) {}

    /** An upload address for a picture of the signed-in person. */
    requestPersonUpload(file: AvatarFile): Promise<AvatarUpload> {
        return this.issue("people", file)
    }

    /** Keeps an uploaded picture on the person's account, or removes it with null (back to the provider's or the generated one). */
    async setPersonAvatar(userId: string, path: OptionalAvatarPath): Promise<void> {
        const address = typeof path === "string" ? this.addressOf("people", path) : null
        const kept = await this.accounts.setUploadedAvatar(userId, address)
        if (kept.kind !== "ok") throw new AvatarsError({ code: AvatarsErrorCode.Unavailable })
    }

    /** An upload address for an agent picture; a manager only. */
    async requestAgentUpload(userId: string, workspaceId: string, file: AvatarFile): Promise<AvatarUpload> {
        await this.members.require(userId, workspaceId, GOVERNORS)
        return this.issue("agents", file)
    }

    /** Sets an uploaded picture on an agent of the workspace, or removes it with null; a manager only. */
    async setAgentAvatar(
        userId: string,
        workspaceId: string,
        agentId: string,
        path: OptionalAvatarPath,
    ): Promise<void> {
        const address = typeof path === "string" ? this.addressOf("agents", path) : null
        await this.identity.setAvatar(userId, workspaceId, agentId, address)
    }

    private async issue(owner: AvatarOwner, file: AvatarFile): Promise<AvatarUpload> {
        const extension = avatarExtensionOf(file)
        if (extension === null) throw new AvatarsError({ code: AvatarsErrorCode.FileInvalid })
        const [allocated] = await callDbFunction<AllocatedId>(this.entityManager, "gen_random_uuid", [])
        if (allocated === undefined) throw new AvatarsError({ code: AvatarsErrorCode.Unavailable })
        const signed = await this.storage.signedUpload(
            AVATAR_BUCKET,
            avatarPathOf(owner, allocated.gen_random_uuid, extension),
        )
        if (signed.kind !== "ok") throw new AvatarsError({ code: AvatarsErrorCode.Unavailable })
        return { ...signed.value, publicUrl: this.storage.publicUrl(AVATAR_BUCKET, signed.value.path) }
    }

    private addressOf(owner: AvatarOwner, path: string): string {
        if (!isAvatarPath(owner, path)) throw new AvatarsError({ code: AvatarsErrorCode.PathInvalid })
        const address = this.storage.publicUrl(AVATAR_BUCKET, path)
        if (!isHttpsAddress(address)) throw new AvatarsError({ code: AvatarsErrorCode.AddressInsecure })
        return address
    }
}
