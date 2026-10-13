import { Injectable } from "@nestjs/common"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { WorkspacesService } from "@modules/domain/workspaces"
import { WorkspaceSeedError, WorkspaceSeedErrorCode } from "./errors/workspace-seed.error"
import { SEED_OWNER, SEED_STAFF, SEED_WORKSPACE_NAME } from "./messages/workspace-seed.messages"
import type { SeedAccount, SeedReport, SeedRequest } from "./workspace-seed.contracts"
import { InjectSeedAuth, InjectWorkspaceSeedOptions } from "./workspace-seed.decorators"
import type { SeedAuth, SeedAuthUser, WorkspaceSeedOptions } from "./workspace-seed.options"
import { newPassword, passwordFor, withSecret } from "./workspace-seed.policy"

const USERS_PER_PAGE = 200
const USER_PAGES_MAX = 50

@Injectable()
/**
 * Seeds the demo account: its two sign-in accounts, the workspace the owner runs and both memberships. It is idempotent:
 * accounts are updated, and a workspace the owner already has is kept. Modules and knowledge are seeded by their own commands.
 */
export class WorkspaceSeedService {
    constructor(
        @InjectWorkspaceSeedOptions() private readonly options: WorkspaceSeedOptions,
        @InjectSeedAuth() private readonly auth: SeedAuth,
        private readonly workspaces: WorkspacesService,
        private readonly members: WorkspaceMembersService,
    ) {}

    /**
     * The operator's run: the passwords come from the secrets file (a fresh one is generated and stored when none is kept for the
     * account), the file is written before Auth is touched so it never lags behind, then the demo account is seeded.
     */
    async seedOperator(): Promise<SeedReport> {
        const { secrets, print } = this.options
        const stored = await secrets.read()
        const accounts = [
            { role: "OWNER", ...SEED_OWNER, password: passwordFor(stored, "OWNER", SEED_OWNER.email, newPassword) },
            { role: "STAFF", ...SEED_STAFF, password: passwordFor(stored, "STAFF", SEED_STAFF.email, newPassword) },
        ] as const
        await secrets.write(
            accounts.reduce(
                (text, account) =>
                    withSecret(
                        withSecret(text, `READY_${account.role}_EMAIL`, account.email),
                        `READY_${account.role}_PASSWORD`,
                        account.password,
                    ),
                stored,
            ),
        )
        const [owner, staff] = accounts
        const report = await this.seed({ owner, staff })
        const lines = [`credentials kept in ${secrets.location}`, ...report.lines]
        for (const line of lines) print(line)
        return { workspaceId: report.workspaceId, lines }
    }

    /** Seeds both accounts, the owner's workspace and both memberships. */
    async seed(request: SeedRequest): Promise<SeedReport> {
        const lines: Array<string> = []
        const ownerId = await this.ensureUser(request.owner, lines)
        const staffId = await this.ensureUser(request.staff, lines)
        const owned = (await this.workspaces.memberships(ownerId)).find((entry) => entry.member.role === "owner")
        const workspaceId = owned?.workspace.id ?? (await this.workspaces.createFree(ownerId, SEED_WORKSPACE_NAME)).id
        lines.push(owned === undefined ? `workspace created ${workspaceId}` : `workspace kept ${workspaceId}`)
        await this.members.join({
            workspaceId,
            userId: staffId,
            role: "staff",
            staffId: null,
            displayName: request.staff.name,
        })
        lines.push(`members: ${request.owner.email} owner, ${request.staff.email} staff`)
        return { workspaceId, lines }
    }

    private async ensureUser(account: SeedAccount, lines: Array<string>): Promise<string> {
        const metadata = { full_name: account.name }
        const existing = await this.findUser(account.email)
        if (existing !== undefined) {
            const { error } = await this.auth.updateUserById(existing.id, {
                password: account.password,
                email_confirm: true,
                user_metadata: { ...existing.user_metadata, ...metadata },
            })
            if (error !== null) this.authFailed(`update ${account.email}`, error.message)
            lines.push(`user exists: ${account.email} (password set)`)
            return existing.id
        }
        const created = await this.auth.createUser({
            email: account.email,
            password: account.password,
            email_confirm: true,
            user_metadata: metadata,
        })
        if (created.error !== null) this.authFailed(`create ${account.email}`, created.error.message)
        if (created.data.user === null) {
            throw new WorkspaceSeedError({ code: WorkspaceSeedErrorCode.RowMissing, params: { what: account.email } })
        }
        lines.push(`user created: ${account.email}`)
        return created.data.user.id
    }

    private async findUser(email: string, page = 1): Promise<SeedAuthUser | undefined> {
        if (page >= USER_PAGES_MAX) return undefined
        const { data, error } = await this.auth.listUsers({ page, perPage: USERS_PER_PAGE })
        if (error !== null) this.authFailed("listUsers", error.message)
        const hit = data.users.find((user) => (user.email ?? "").toLowerCase() === email)
        if (hit !== undefined) return hit
        return data.users.length < USERS_PER_PAGE ? undefined : this.findUser(email, page + 1)
    }

    private authFailed(step: string, message: string): never {
        throw new WorkspaceSeedError({ code: WorkspaceSeedErrorCode.AuthFailed, params: { step, message } })
    }
}
