import { Injectable } from "@nestjs/common"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceRole } from "@modules/domain/workspace-members"
import type { ZaloAuthorization, ZaloReturn } from "./channels.contracts"
import { ZaloCredentialsService } from "./zalo-credentials.service"

/** The roles that may connect a channel of the workspace. */
const MANAGERS: ReadonlyArray<WorkspaceRole> = ["owner", "manager"]

@Injectable()
/** The owner side of connecting a Zalo OA: only an owner or manager of the connection workspace starts or completes an authorization. */
export class ZaloAuthorizationService {
    constructor(
        private readonly members: WorkspaceMembersService,
        private readonly credentials: ZaloCredentialsService,
    ) {}

    /** Starts the authorization of a connection and answers the Zalo permission page to open. */
    async begin(userId: string, workspaceId: string, connectionId: string): Promise<ZaloAuthorization> {
        await this.members.require(userId, workspaceId, MANAGERS)
        return this.credentials.beginAuthorization(workspaceId, connectionId)
    }

    /** Completes the authorization Zalo returned the browser with and answers the connection id. */
    async complete(userId: string, workspaceId: string, input: ZaloReturn): Promise<string> {
        await this.members.require(userId, workspaceId, MANAGERS)
        return this.credentials.completeAuthorization(workspaceId, input)
    }
}
