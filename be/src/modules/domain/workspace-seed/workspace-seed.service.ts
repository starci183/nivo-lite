import { Injectable } from "@nestjs/common"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { WorkspacesService } from "@modules/domain/workspaces"
import type { Secret } from "@modules/platform/config"
import { WorkspaceSeedError, WorkspaceSeedErrorCode } from "./errors/workspace-seed.error"
import { WORKSPACE_RECEIPT_PREFIX } from "./messages/workspace-seed.messages"
import type { OwnedSeed, SeedAccount, SeedReport, SeedRequest, SeedRoleRequest } from "./workspace-seed.contracts"
import { InjectSeedAuth, InjectWorkspaceSeedOptions } from "./workspace-seed.decorators"
import type { SeedAuth, SeedAuthUser, WorkspaceSeedOptions } from "./workspace-seed.options"
import { assertSeedScope, readSeedInput, seedPassword } from "./workspace-seed.policy"

const USERS_PER_PAGE = 200
const USER_PAGES_MAX = 50

const report = (
    action: SeedReport["action"],
    workspaceId: string,
    authentication: SeedReport["authentication"] = "existing-session",
): SeedReport => ({
    schema: "starci/app-workspace-access@1",
    ok: true,
    action,
    workspaceId,
    publicReadback: true,
    consumerVerified: false,
    authentication,
    sessionCleanup: authentication === "password-session" ? "acknowledged" : "not-created",
})

@Injectable()
/** Ensures explicitly selected accounts and workspace memberships without rotating existing credentials. */
export class WorkspaceSeedService {
    constructor(
        @InjectWorkspaceSeedOptions() private readonly options: WorkspaceSeedOptions,
        @InjectSeedAuth() private readonly auth: SeedAuth,
        private readonly workspaces: WorkspacesService,
        private readonly members: WorkspaceMembersService,
    ) {}

    /** Runs the private ensure input and emits only the closed public receipt; the legacy run alias is equally safe. */
    async seedOperator(): Promise<SeedReport> {
        const input = readSeedInput(this.options.input)
        if (input.action !== "ensure") throw new WorkspaceSeedError({ code: WorkspaceSeedErrorCode.InputInvalid })
        return this.print(await this.seed(input.request))
    }

    /** Runs an explicit role change using a provider-authenticated actor and the existing membership policy. */
    async roleOperator(): Promise<SeedReport> {
        const input = readSeedInput(this.options.input)
        if (input.action !== "role") throw new WorkspaceSeedError({ code: WorkspaceSeedErrorCode.InputInvalid })
        return this.print(await this.changeRole(input.request))
    }

    /** Reconciles by authenticated readback without domain writes; password authentication owns and closes its session. */
    async verifyOperator(): Promise<SeedReport> {
        const input = readSeedInput(this.options.input)
        const workspaceId =
            input.action === "ensure" ? await this.verifySeed(input.request) : await this.verifyRole(input.request)
        const authentication =
            input.action === "ensure" && input.request.principalToken === undefined
                ? "password-session"
                : "existing-session"
        return this.print(report("verify", workspaceId, authentication))
    }

    /** Ensures owner, manager and staff for one explicit workspace; existing account and seat state is retained. */
    async seed(request: SeedRequest): Promise<SeedReport> {
        return (await this.seedOwned(request)).report
    }

    /** Ensures the workspace like `seed` and also answers the owner Auth authenticated for it. */
    async seedOwned(request: SeedRequest): Promise<OwnedSeed> {
        const scope = assertSeedScope(request)
        const found = await this.findUsers()
        for (const account of [request.owner, request.manager, request.staff]) {
            if (!found.has(account.email)) seedPassword(account)
        }
        return this.withOwnerPrincipal(request, found, true, async (ownerId) => {
            const workspaceId = "id" in scope ? scope.id : (await this.workspaces.ensureNamed(ownerId, scope.name)).id
            await this.members.require(ownerId, workspaceId, ["owner"])
            const managerId = await this.ensureUser(request.manager, found)
            const staffId = await this.ensureUser(request.staff, found)
            await this.members.ensure(ownerId, {
                workspaceId,
                userId: managerId,
                role: "manager",
                staffId: null,
                displayName: request.manager.name,
            })
            await this.members.ensure(ownerId, {
                workspaceId,
                userId: staffId,
                role: "staff",
                staffId: null,
                displayName: request.staff.name,
            })
            await this.readSeats(ownerId, managerId, staffId, workspaceId)
            const authentication = request.principalToken === undefined ? "password-session" : "existing-session"
            return { report: report("ensure", workspaceId, authentication), ownerId }
        })
    }

    /** Delegates role authorization to WorkspaceMembersService after authenticating the actual session. */
    async changeRole(request: SeedRoleRequest): Promise<SeedReport> {
        const actorId = await this.sessionPrincipal(request.principalToken)
        await this.members.changeRole(actorId, request.workspaceId, request.memberId, request.role)
        await this.members.require(request.memberId, request.workspaceId, [request.role])
        return report("role", request.workspaceId)
    }

    private print(receipt: SeedReport): SeedReport {
        this.options.print(`${WORKSPACE_RECEIPT_PREFIX}${JSON.stringify(receipt)}`)
        return receipt
    }

    /** Holds one authenticated identity for the action and closes only a password session it created. */
    private async withOwnerPrincipal<T>(
        request: SeedRequest,
        found: ReadonlyMap<string, SeedAuthUser>,
        create: boolean,
        action: (id: string) => Promise<T>,
    ): Promise<T> {
        const existing = found.get(request.owner.email)
        if (request.principalToken !== undefined) {
            const id = await this.sessionPrincipal(request.principalToken)
            if (existing?.id !== id) throw new WorkspaceSeedError({ code: WorkspaceSeedErrorCode.PrincipalInvalid })
            return action(id)
        }
        if (request.owner.password === undefined)
            throw new WorkspaceSeedError({ code: WorkspaceSeedErrorCode.PrincipalInvalid })
        if (existing === undefined && (!create || request.bootstrapOwner !== true))
            throw new WorkspaceSeedError({ code: WorkspaceSeedErrorCode.BootstrapRequired })
        const ownerId = existing?.id ?? (await this.ensureUser(request.owner, found))
        const session = await this.auth.openPasswordPrincipal(request.owner.email, request.owner.password.reveal())
        if (session === null) throw new WorkspaceSeedError({ code: WorkspaceSeedErrorCode.PrincipalInvalid })
        try {
            if (session.id !== ownerId) throw new WorkspaceSeedError({ code: WorkspaceSeedErrorCode.PrincipalInvalid })
            return await action(session.id)
        } finally {
            if (!(await session.close()))
                throw new WorkspaceSeedError({ code: WorkspaceSeedErrorCode.SessionCleanupFailed })
        }
    }

    private async sessionPrincipal(token: Secret): Promise<string> {
        const id = await this.auth.verifyUser(token.reveal())
        if (id === null) throw new WorkspaceSeedError({ code: WorkspaceSeedErrorCode.PrincipalInvalid })
        return id
    }

    private async ensureUser(account: SeedAccount, found: ReadonlyMap<string, SeedAuthUser>): Promise<string> {
        const existing = found.get(account.email)
        if (existing !== undefined) return existing.id
        const created = await this.auth.createUser({
            email: account.email,
            password: seedPassword(account).reveal(),
            email_confirm: true,
            user_metadata: { full_name: account.name },
        })
        if (created.error !== null) {
            const reconciled = (await this.findUsers()).get(account.email)
            if (reconciled !== undefined) return reconciled.id
            throw new WorkspaceSeedError({ code: WorkspaceSeedErrorCode.AuthFailed })
        }
        if (created.data.user === null) throw new WorkspaceSeedError({ code: WorkspaceSeedErrorCode.RowMissing })
        return created.data.user.id
    }

    private async findUsers(
        page = 1,
        users = new Map<string, SeedAuthUser>(),
    ): Promise<ReadonlyMap<string, SeedAuthUser>> {
        const result = await this.auth.listUsers({ page, perPage: USERS_PER_PAGE })
        if (result.error !== null) throw new WorkspaceSeedError({ code: WorkspaceSeedErrorCode.AuthFailed })
        for (const user of result.data.users) {
            if (user.email !== undefined) users.set(user.email.toLowerCase(), user)
        }
        if (result.data.users.length < USERS_PER_PAGE) return users
        if (page >= USER_PAGES_MAX) throw new WorkspaceSeedError({ code: WorkspaceSeedErrorCode.ScanIncomplete })
        return this.findUsers(page + 1, users)
    }

    private async readSeats(ownerId: string, managerId: string, staffId: string, workspaceId: string): Promise<void> {
        await Promise.all([
            this.members.require(ownerId, workspaceId, ["owner"]),
            this.members.require(managerId, workspaceId, ["manager"]),
            this.members.require(staffId, workspaceId, ["staff"]),
        ])
    }

    private async verifySeed(request: SeedRequest): Promise<string> {
        assertSeedScope(request)
        const found = await this.findUsers()
        const owner = found.get(request.owner.email),
            manager = found.get(request.manager.email),
            staff = found.get(request.staff.email)
        if (owner === undefined || manager === undefined || staff === undefined)
            throw new WorkspaceSeedError({ code: WorkspaceSeedErrorCode.VerificationFailed })
        return this.withOwnerPrincipal(request, found, false, async (actorId) => {
            const owned = (await this.workspaces.memberships(actorId)).filter(
                (entry) =>
                    entry.member.role === "owner" &&
                    entry.member.status === "active" &&
                    entry.workspace.name === request.workspaceName,
            )
            const workspaceId = request.workspaceId ?? (owned.length === 1 ? owned[0]?.workspace.id : undefined)
            if (workspaceId === undefined)
                throw new WorkspaceSeedError({ code: WorkspaceSeedErrorCode.VerificationFailed })
            await this.readSeats(owner.id, manager.id, staff.id, workspaceId)
            return workspaceId
        })
    }

    private async verifyRole(request: SeedRoleRequest): Promise<string> {
        const actorId = await this.sessionPrincipal(request.principalToken)
        await this.members.require(actorId, request.workspaceId, ["owner", "manager"])
        await this.members.require(request.memberId, request.workspaceId, [request.role])
        return request.workspaceId
    }
}
