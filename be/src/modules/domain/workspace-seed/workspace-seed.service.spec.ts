import { AgentRecordsService } from "@modules/domain/agents"
import { ProfileSourcesService } from "@modules/domain/knowledge-sources"
import { McpToolGrantsService } from "@modules/domain/mcp-tool-grants"
import { McpGatewayAdminService } from "@modules/domain/mcp-gateway"
import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { WorkspacesService } from "@modules/domain/workspaces"
import type { WorkspaceMembership } from "@modules/domain/workspaces"
import { Secret } from "@modules/platform/config"
import { WorkspaceSeedErrorCode } from "./errors/workspace-seed.error"
import { WORKSPACE_RECEIPT_PREFIX } from "./messages/workspace-seed.messages"
import type { SeedRequest } from "./workspace-seed.contracts"
import { SEED_AUTH, WORKSPACE_SEED_OPTIONS } from "./workspace-seed.decorators"
import type { SeedAuth, SeedAuthUser, SeedNewUser, WorkspaceSeedOptions } from "./workspace-seed.options"
import { WorkspaceSeedService } from "./workspace-seed.service"

const WS = "11111111-1111-4111-8111-111111111111"
const OWNER = "22222222-2222-4222-8222-222222222222"
const MANAGER = "33333333-3333-4333-8333-333333333333"
const STAFF = "44444444-4444-4444-8444-444444444444"
const ACCOUNTS = [
    { id: OWNER, email: "owner@example.test" },
    { id: MANAGER, email: "manager@example.test" },
    { id: STAFF, email: "staff@example.test" },
]
const REQUEST: SeedRequest = {
    workspaceId: WS,
    owner: { email: "owner@example.test", name: "Owner", password: new Secret("owner-private") },
    manager: { email: "manager@example.test", name: "Manager", password: new Secret("manager-private") },
    staff: { email: "staff@example.test", name: "Staff", password: new Secret("staff-private") },
}
const wire = {
    schema: "starci/app-workspace-input@1",
    action: "ensure",
    workspaceId: WS,
    owner: { email: REQUEST.owner.email, name: "Owner", password: "owner-private" },
    manager: { email: REQUEST.manager.email, name: "Manager", password: "manager-private" },
    staff: { email: REQUEST.staff.email, name: "Staff", password: "staff-private" },
}
const inputOf = (value: unknown): Secret => new Secret(JSON.stringify(value))
const receipt = (
    action: "ensure" | "role" | "verify",
    authentication: "password-session" | "existing-session" = "password-session",
) => ({
    schema: "starci/app-workspace-access@1",
    ok: true,
    action,
    workspaceId: WS,
    publicReadback: true,
    consumerVerified: false,
    authentication,
    sessionCleanup: authentication === "password-session" ? "acknowledged" : "not-created",
})
const named = builder<WorkspaceMembership>({
    workspace: {
        id: WS,
        name: "Explicit workspace",
        status: "active",
        ownerId: OWNER,
        createdAt: "2026-10-19T00:00:00.000Z",
        businessType: null,
    },
    member: { userId: OWNER, workspaceId: WS, role: "owner", staffId: null, displayName: "Owner", status: "active" },
})

const build = async (input?: Secret) => {
    const close = jest.fn().mockResolvedValue(true)
    const auth = mock<
        SeedAuth & { updateUserById(id: string, update: Readonly<Record<string, string>>): Promise<void> }
    >({
        listUsers: jest.fn().mockResolvedValue({ data: { users: ACCOUNTS }, error: null }),
        createUser: jest.fn().mockImplementation((user: SeedNewUser) =>
            Promise.resolve({
                data: { user: ACCOUNTS.find((account) => account.email === user.email) },
                error: null,
            }),
        ),
        openPasswordPrincipal: jest.fn().mockResolvedValue({ id: OWNER, close }),
        verifyUser: jest.fn().mockResolvedValue(OWNER),
    })
    const print = jest.fn(),
        workspaces = mock<WorkspacesService>(),
        members = mock<WorkspaceMembersService>()
    workspaces.ensureNamed.mockResolvedValue({ id: WS })
    workspaces.memberships.mockResolvedValue([named()])
    const ports = {
        agents: AgentRecordsService,
        sources: ProfileSourcesService,
        toolGrants: McpToolGrantsService,
        connectors: McpGatewayAdminService,
    }
    const options: WorkspaceSeedOptions = { auth: "auth", ports, input, print }
    const moduleRef = await Test.createTestingModule({
        providers: [
            WorkspaceSeedService,
            { provide: WORKSPACE_SEED_OPTIONS, useValue: options },
            { provide: SEED_AUTH, useValue: auth },
            { provide: WorkspacesService, useValue: workspaces },
            { provide: WorkspaceMembersService, useValue: members },
        ],
    }).compile()
    return { seed: moduleRef.get(WorkspaceSeedService), auth, print, workspaces, members, close }
}

describe("WorkspaceSeedService / ensure", () => {
    it("keeps all existing credentials and seats on repeated ensure", async () => {
        const { seed, auth, members, workspaces } = await build()
        await expect(seed.seed(REQUEST)).resolves.toEqual(receipt("ensure"))
        await seed.seed(REQUEST)
        expect(auth.createUser).not.toHaveBeenCalled()
        expect(auth.updateUserById).not.toHaveBeenCalled()
        expect(workspaces.ensureNamed).not.toHaveBeenCalled()
        expect(auth.openPasswordPrincipal).toHaveBeenCalledWith("owner@example.test", "owner-private")
        expect(members.ensure).toHaveBeenCalledWith(OWNER, {
            workspaceId: WS,
            userId: MANAGER,
            role: "manager",
            staffId: null,
            displayName: "Manager",
        })
        expect(members.require).toHaveBeenCalledWith(STAFF, WS, ["staff"])
    })

    it("answers the authenticated owner together with the receipt for the profile steps", async () => {
        const { seed } = await build()
        await expect(seed.seedOwned(REQUEST)).resolves.toEqual({ report: receipt("ensure"), ownerId: OWNER })
    })

    it("creates only missing accounts and uses the explicit workspace name", async () => {
        const { seed, auth, workspaces } = await build()
        auth.listUsers.mockResolvedValue({ data: { users: [] }, error: null })
        await seed.seed({
            ...REQUEST,
            workspaceId: undefined,
            workspaceName: "Explicit workspace",
            bootstrapOwner: true,
        })
        expect(auth.createUser).toHaveBeenCalledTimes(3)
        expect(auth.createUser).toHaveBeenCalledWith({
            email: "manager@example.test",
            password: "manager-private",
            email_confirm: true,
            user_metadata: { full_name: "Manager" },
        })
        expect(workspaces.ensureNamed).toHaveBeenCalledWith(OWNER, "Explicit workspace")
        expect(auth.updateUserById).not.toHaveBeenCalled()
    })
})

describe("WorkspaceSeedService / initial credential preflight", () => {
    it("requires initial credentials for every missing account before any write", async () => {
        const { seed, auth, members } = await build()
        auth.listUsers.mockResolvedValue({ data: { users: [] }, error: null })
        await expect(
            seed.seed({ ...REQUEST, staff: { email: "staff@example.test", name: "Staff" } }),
        ).rejects.toMatchObject({ code: WorkspaceSeedErrorCode.PasswordRequired })
        expect(auth.createUser).not.toHaveBeenCalled()
        expect(members.ensure).not.toHaveBeenCalled()
    })

    it("authenticates a session and refuses a different owner before workspace effects", async () => {
        const { seed, auth, workspaces } = await build()
        auth.verifyUser.mockResolvedValue(STAFF)
        await expect(seed.seed({ ...REQUEST, principalToken: new Secret("session-private") })).rejects.toMatchObject({
            code: WorkspaceSeedErrorCode.PrincipalInvalid,
        })
        expect(auth.openPasswordPrincipal).not.toHaveBeenCalled()
        expect(workspaces.ensureNamed).not.toHaveBeenCalled()
    })
})

describe("WorkspaceSeedService / owner bootstrap authorization", () => {
    it("rejects a supplied principal for a missing owner before creating any Auth account", async () => {
        const { seed, auth } = await build()
        auth.listUsers.mockResolvedValue({ data: { users: [] }, error: null })
        await expect(
            seed.seed({ ...REQUEST, bootstrapOwner: true, principalToken: new Secret("session") }),
        ).rejects.toMatchObject({ code: WorkspaceSeedErrorCode.PrincipalInvalid })
        expect(auth.createUser).not.toHaveBeenCalled()
        expect(auth.openPasswordPrincipal).not.toHaveBeenCalled()
    })

    it("requires explicit first-owner bootstrap instead of creating an account from a password alone", async () => {
        const { seed, auth } = await build()
        auth.listUsers.mockResolvedValue({ data: { users: [] }, error: null })
        await expect(seed.seed(REQUEST)).rejects.toMatchObject({ code: WorkspaceSeedErrorCode.BootstrapRequired })
        expect(auth.createUser).not.toHaveBeenCalled()
    })

    it("retains an existing owner session and creates no password session", async () => {
        const { seed, auth, close } = await build()
        await expect(seed.seed({ ...REQUEST, principalToken: new Secret("session") })).resolves.toEqual(
            receipt("ensure", "existing-session"),
        )
        expect(auth.openPasswordPrincipal).not.toHaveBeenCalled()
        expect(close).not.toHaveBeenCalled()
    })
})

describe("WorkspaceSeedService / owned password session", () => {
    it("cleans up an owned password session even when it authenticates a different identity", async () => {
        const { seed, auth, close, members } = await build()
        auth.openPasswordPrincipal.mockResolvedValue({ id: STAFF, close })
        await expect(seed.seed(REQUEST)).rejects.toMatchObject({ code: WorkspaceSeedErrorCode.PrincipalInvalid })
        expect(close).toHaveBeenCalledTimes(1)
        expect(members.ensure).not.toHaveBeenCalled()
    })

    it("does not emit success when Auth cannot acknowledge cleanup after domain effects", async () => {
        const { seed, close, print } = await build(inputOf(wire))
        close.mockResolvedValue(false)
        await expect(seed.seedOperator()).rejects.toMatchObject({ code: WorkspaceSeedErrorCode.SessionCleanupFailed })
        expect(print).not.toHaveBeenCalled()
    })

    it.each(["password", "session", "missing"])("refuses invalid %s authentication", async (kind) => {
        const { seed, auth, members } = await build()
        auth.openPasswordPrincipal.mockResolvedValue(null)
        auth.verifyUser.mockResolvedValue(null)
        const owner = kind === "missing" ? { email: REQUEST.owner.email, name: REQUEST.owner.name } : REQUEST.owner
        await expect(
            seed.seed({ ...REQUEST, owner, principalToken: kind === "session" ? new Secret("bad") : undefined }),
        ).rejects.toMatchObject({ code: WorkspaceSeedErrorCode.PrincipalInvalid })
        expect(members.ensure).not.toHaveBeenCalled()
    })
})

describe("WorkspaceSeedService / Auth scan and create reconciliation", () => {
    it("does not disclose provider errors while scanning", async () => {
        const { seed, auth, print } = await build()
        auth.listUsers.mockResolvedValue({ data: { users: [] }, error: { message: "provider echoed private-token" } })
        await expect(seed.seed(REQUEST)).rejects.toMatchObject({ code: WorkspaceSeedErrorCode.AuthFailed, params: {} })
        expect(print).not.toHaveBeenCalled()
    })

    it("reconciles a create conflict without resetting the newly discovered account", async () => {
        const { seed, auth } = await build()
        auth.listUsers.mockResolvedValueOnce({ data: { users: [] }, error: null })
        auth.createUser.mockResolvedValue({ data: { user: null }, error: { message: "concurrent create" } })
        await seed.seed({ ...REQUEST, bootstrapOwner: true })
        expect(auth.updateUserById).not.toHaveBeenCalled()
        expect(auth.createUser).toHaveBeenCalledTimes(3)
    })

    it.each([true, false])("refuses create without a usable user, provider failure=%s", async (failed) => {
        const { seed, auth, members } = await build()
        auth.listUsers.mockResolvedValue({ data: { users: [] }, error: null })
        auth.createUser.mockResolvedValue({ data: { user: null }, error: failed ? { message: "secret" } : null })
        await expect(seed.seed({ ...REQUEST, bootstrapOwner: true })).rejects.toMatchObject({
            code: failed ? WorkspaceSeedErrorCode.AuthFailed : WorkspaceSeedErrorCode.RowMissing,
        })
        expect(members.ensure).not.toHaveBeenCalled()
    })
})

describe("WorkspaceSeedService / bounded account scan", () => {
    it("walks later pages while refusing an incomplete full scan", async () => {
        const { seed, auth } = await build()
        const full: Array<SeedAuthUser> = Array.from({ length: 200 }, (_, i) => ({ id: `unused-${i}` }))
        auth.listUsers.mockResolvedValueOnce({ data: { users: full }, error: null })
        await seed.seed(REQUEST)
        expect(auth.listUsers).toHaveBeenNthCalledWith(2, { page: 2, perPage: 200 })
        auth.listUsers.mockResolvedValue({ data: { users: full }, error: null })
        await expect(seed.seed(REQUEST)).rejects.toMatchObject({ code: WorkspaceSeedErrorCode.ScanIncomplete })
        expect(auth.createUser).not.toHaveBeenCalled()
    })
})

describe("WorkspaceSeedService / operator receipt and recovery", () => {
    it("prints only the public receipt and never creates or prints a replacement password", async () => {
        const { seed, print, auth } = await build(inputOf(wire))
        await expect(seed.seedOperator()).resolves.toEqual(receipt("ensure"))
        expect(print).toHaveBeenCalledWith(`${WORKSPACE_RECEIPT_PREFIX}${JSON.stringify(receipt("ensure"))}`)
        expect(auth.updateUserById).not.toHaveBeenCalled()
        expect(JSON.stringify(print.mock.calls)).not.toContain("private")
    })

    it("requires private input and refuses a mismatched command", async () => {
        await expect((await build()).seed.seedOperator()).rejects.toMatchObject({
            code: WorkspaceSeedErrorCode.InputRequired,
        })
        const roleWire = {
            schema: "starci/app-workspace-input@1",
            action: "role",
            workspaceId: WS,
            memberId: STAFF,
            role: "manager",
            principalToken: "token",
        }
        await expect((await build(inputOf(roleWire))).seed.seedOperator()).rejects.toMatchObject({
            code: WorkspaceSeedErrorCode.InputInvalid,
        })
        await expect((await build(inputOf(wire))).seed.roleOperator()).rejects.toMatchObject({
            code: WorkspaceSeedErrorCode.InputInvalid,
        })
    })
})

describe("WorkspaceSeedService / authenticated role policy", () => {
    it("authenticates a role actor and delegates the existing domain policy", async () => {
        const roleWire = {
            schema: "starci/app-workspace-input@1",
            action: "role",
            workspaceId: WS,
            memberId: STAFF,
            role: "manager",
            principalToken: "session-private",
        }
        const { seed, auth, members } = await build(inputOf(roleWire))
        await seed.roleOperator()
        expect(auth.verifyUser).toHaveBeenCalledWith("session-private")
        expect(members.changeRole).toHaveBeenCalledWith(OWNER, WS, STAFF, "manager")
        expect(members.require).toHaveBeenCalledWith(STAFF, WS, ["manager"])
    })

    it("reconciles ensure without domain writes and closes its explicitly scoped password session", async () => {
        const { seed, auth, members, workspaces, close } = await build(inputOf(wire))
        await expect(seed.verifyOperator()).resolves.toEqual(receipt("verify"))
        expect(auth.createUser).not.toHaveBeenCalled()
        expect(auth.updateUserById).not.toHaveBeenCalled()
        expect(members.ensure).not.toHaveBeenCalled()
        expect(workspaces.ensureNamed).not.toHaveBeenCalled()
        expect(close).toHaveBeenCalledTimes(1)
    })

    it("reconciles role by authenticated reads without changing it again", async () => {
        const { seed, members } = await build(
            inputOf({
                schema: "starci/app-workspace-input@1",
                action: "role",
                workspaceId: WS,
                memberId: STAFF,
                role: "manager",
                principalToken: "token",
            }),
        )
        await expect(seed.verifyOperator()).resolves.toEqual(receipt("verify", "existing-session"))
        expect(members.changeRole).not.toHaveBeenCalled()
        expect(members.require).toHaveBeenCalledWith(OWNER, WS, ["owner", "manager"])
    })
})

describe("WorkspaceSeedService / exact recovery selector", () => {
    it("finds exactly the requested active owned workspace during name reconciliation", async () => {
        const { seed, workspaces, members, close } = await build(
            inputOf({ ...wire, workspaceId: undefined, workspaceName: "Explicit workspace" }),
        )
        workspaces.memberships.mockResolvedValue([
            named({ member: { ...named().member, role: "manager" } }),
            named({ member: { ...named().member, status: "disabled" } }),
            named({ workspace: { ...named().workspace, name: "Another workspace" } }),
            named(),
        ])
        await expect(seed.verifyOperator()).resolves.toEqual(receipt("verify"))
        expect(members.require).toHaveBeenCalledWith(OWNER, WS, ["owner"])
        expect(close).toHaveBeenCalledTimes(1)
    })

    it.each([0, 2])("refuses name reconciliation with %s matching workspaces", async (count) => {
        const { seed, workspaces, close, print } = await build(
            inputOf({ ...wire, workspaceId: undefined, workspaceName: "Explicit workspace" }),
        )
        workspaces.memberships.mockResolvedValue(Array.from({ length: count }, () => named()))
        await expect(seed.verifyOperator()).rejects.toMatchObject({ code: WorkspaceSeedErrorCode.VerificationFailed })
        expect(close).toHaveBeenCalledTimes(1)
        expect(print).not.toHaveBeenCalled()
    })
})

describe("WorkspaceSeedService / recovery refusal", () => {
    it.each([OWNER, MANAGER, STAFF])("refuses recovery when requested account %s is absent", async (missing) => {
        const { seed, auth, print } = await build(inputOf(wire))
        auth.listUsers.mockResolvedValue({
            data: { users: ACCOUNTS.filter((account) => account.id !== missing) },
            error: null,
        })
        await expect(seed.verifyOperator()).rejects.toMatchObject({ code: WorkspaceSeedErrorCode.VerificationFailed })
        expect(auth.createUser).not.toHaveBeenCalled()
        expect(auth.openPasswordPrincipal).not.toHaveBeenCalled()
        expect(print).not.toHaveBeenCalled()
    })

    it("retains the existing authenticated owner session during recovery", async () => {
        const { seed, auth, close } = await build(inputOf({ ...wire, principalToken: "session-private" }))
        await expect(seed.verifyOperator()).resolves.toEqual(receipt("verify", "existing-session"))
        expect(auth.openPasswordPrincipal).not.toHaveBeenCalled()
        expect(close).not.toHaveBeenCalled()
    })

    it("keeps provider or policy failure non-successful without printing", async () => {
        const { seed, members, print } = await build(inputOf(wire))
        members.require.mockRejectedValue(new Error("policy refusal"))
        await expect(seed.seedOperator()).rejects.toThrow("policy refusal")
        expect(print).not.toHaveBeenCalled()
    })
})

describe("WorkspaceSeedService / ensureSeat", () => {
    it("seats an existing account as the owner without creating or changing anything", async () => {
        const { seed, auth, members } = await build()

        await expect(seed.ensureSeat(OWNER, WS, { email: "staff@example.test", name: "Staff" }, "staff")).resolves.toBe(
            STAFF,
        )

        expect(auth.createUser).not.toHaveBeenCalled()
        expect(members.ensure).toHaveBeenCalledWith(OWNER, {
            workspaceId: WS,
            userId: STAFF,
            role: "staff",
            staffId: null,
            displayName: "Staff",
        })
    })

    it("creates a missing account from its private password and seats it", async () => {
        const { seed, auth, members } = await build()
        auth.createUser.mockResolvedValue({
            data: { user: { id: "55555555-5555-4555-8555-555555555555" } },
            error: null,
        })

        await expect(
            seed.ensureSeat(
                OWNER,
                WS,
                { email: "ha@example.test", name: "Chi Ha", password: new Secret("ha-private") },
                "manager",
            ),
        ).resolves.toBe("55555555-5555-4555-8555-555555555555")

        expect(auth.createUser).toHaveBeenCalledWith({
            email: "ha@example.test",
            password: "ha-private",
            email_confirm: true,
            user_metadata: { full_name: "Chi Ha" },
        })
        expect(members.ensure).toHaveBeenCalledWith(OWNER, expect.objectContaining({ role: "manager" }))
    })

    it("refuses a missing account that has no initial password before any seat", async () => {
        const { seed, members } = await build()

        await expect(
            seed.ensureSeat(OWNER, WS, { email: "nobody@example.test", name: "Nobody" }, "staff"),
        ).rejects.toMatchObject({ code: WorkspaceSeedErrorCode.PasswordRequired })
        expect(members.ensure).not.toHaveBeenCalled()
    })
})
