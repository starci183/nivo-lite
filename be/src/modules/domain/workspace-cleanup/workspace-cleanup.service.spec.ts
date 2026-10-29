import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import { WorkspaceEntity, WorkspacePruneService } from "@modules/domain/workspaces"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { fakeQueryBuilder } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import type { FakeQueryBuilder } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { WorkspaceCleanupErrorCode } from "./errors/workspace-cleanup.error"
import { CLEANUP_RECEIPT_PREFIX } from "./messages/workspace-cleanup.messages"
import type { UserReferenceRow, WorkspaceFootprintRow } from "./persistence/workspace-cleanup.rows"
import type { CleanupCommand, CleanupReport } from "./workspace-cleanup.contracts"
import { CLEANUP_ACCOUNTS, WORKSPACE_CLEANUP_OPTIONS } from "./workspace-cleanup.decorators"
import type { CleanupAccounts, CleanupAuthUser, CleanupUserDeleted } from "./workspace-cleanup.options"
import { WorkspaceCleanupService } from "./workspace-cleanup.service"

/** A partial-object matcher, typed `unknown` so it flows into any slot. */
const objectLike = (shape: Record<string, unknown>): unknown => expect.objectContaining(shape)

/** A substring matcher, typed `unknown` so it flows into any slot. */
const stringLike = (text: string): unknown => expect.stringContaining(text)

/** The match-anything matcher, typed `unknown` so it flows into any slot. */
const anything = (): unknown => expect.anything()

const WORKSPACE_FOOTPRINT = "SELECT * FROM public.workspace_footprint($1)"
const WORKSPACE_USER_REFERENCES = "SELECT * FROM public.workspace_user_references($1, $2)"

const HAKUEN = "cd312306-c950-4328-8b88-022553070ae6"
const SPA = "11111111-1111-4111-8111-111111111111"
const OWNER = { id: "u-owner", email: "hakuen.demo@gmail.com" }
const STAFF = { id: "u-staff", email: "staff@hakuen.test" }
const ORPHAN = { id: "u-orphan", email: "spa@example.test" }
const KEPT_ROW: WorkspaceFootprintRow = { id: HAKUEN, name: "HAKUEN", footprint: null }
const SPA_ROW: WorkspaceFootprintRow = { id: SPA, name: "Spa", footprint: { leads: 2, workspace_members: 1 } }
const KEPT = [{ user_id: OWNER.id }, { user_id: STAFF.id }]
const CLEAN = { cascade: { "app_commands.requested_by": 0 }, block: { "lead_actions.requested_by": 0 } }

/** What the doubles answer in one spec. */
interface Fixture {
    readonly workspaces?: ReadonlyArray<WorkspaceFootprintRow>
    readonly kept?: ReadonlyArray<{ user_id: string }>
    readonly users?: ReadonlyArray<CleanupAuthUser>
    readonly refs?: Readonly<Record<string, unknown>>
}

const referenceRows = (fixture: Fixture): ReadonlyArray<UserReferenceRow> =>
    (fixture.users ?? [OWNER, STAFF, ORPHAN])
        .filter((user) => !(fixture.kept ?? KEPT).some((row) => row.user_id === user.id))
        .map((user) => ({ user_id: user.id, refs: fixture.refs?.[user.id] ?? CLEAN }))

const build = async (fixture: Fixture = {}) => {
    const workspaces = fixture.workspaces ?? [KEPT_ROW, SPA_ROW]
    const footprints = workspaces
        .filter((row) => row.footprint !== null)
        .map((row) => [WORKSPACE_FOOTPRINT, [{ workspace_footprint: row.footprint }]] as const)
    const references = referenceRows(fixture).map(
        (row) => [WORKSPACE_USER_REFERENCES, [{ workspace_user_references: row.refs }]] as const,
    )
    const calls: ReadonlyArray<readonly [string, unknown]> = [...footprints, ...references]
    const em = mockEntityManager({
        find: [
            WorkspaceEntity,
            workspaces.map((row) => Object.assign(new WorkspaceEntity(), { id: row.id, name: row.name })),
        ],
        query: calls.length === 0 ? [["no statement expected", []]] : calls,
    })
    const keptRows = fixture.kept ?? KEPT
    const builders: Array<FakeQueryBuilder> = []
    em.createQueryBuilder.mockImplementation((() => {
        // the members read first, the owners read second, per survey
        const fake = fakeQueryBuilder({
            getRawMany: builders.length % 2 === 0 ? keptRows.slice(1) : keptRows.slice(0, 1),
        })
        builders.push(fake)
        return fake.builder
    }) as never)
    const prune = mock<WorkspacePruneService>()
    const accounts = mock<CleanupAccounts>()
    accounts.listUsers.mockResolvedValue({ data: { users: fixture.users ?? [OWNER, STAFF, ORPHAN] }, error: null })
    accounts.deleteUser.mockResolvedValue({ error: null })
    const print = jest.fn()
    const moduleRef = await Test.createTestingModule({
        providers: [
            WorkspaceCleanupService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: WorkspacePruneService, useValue: prune },
            { provide: CLEANUP_ACCOUNTS, useValue: accounts },
            { provide: WORKSPACE_CLEANUP_OPTIONS, useValue: { accounts: CLEANUP_ACCOUNTS, print } },
        ],
    }).compile()
    return { cleanup: moduleRef.get(WorkspaceCleanupService), em, prune, accounts, print, builders }
}

const refusedWith = (code: WorkspaceCleanupErrorCode, params?: Record<string, string | number>) =>
    objectLike(params === undefined ? { code } : { code, params })

const receiptLineOf = (report: CleanupReport): string => `${CLEANUP_RECEIPT_PREFIX}${JSON.stringify(report)}`

const digestOf = async (fixture: Fixture = {}, command: CleanupCommand = {}): Promise<string> => {
    const { cleanup } = await build(fixture)
    return (await cleanup.run({ ...command, keep: HAKUEN, dryRun: true })).digest
}

describe("WorkspaceCleanupService dry run", () => {
    it("refuses an empty keep list before reading anything", async () => {
        const { cleanup, em, prune } = await build()

        await expect(cleanup.run({ keep: " ", dryRun: true })).rejects.toEqual(
            refusedWith(WorkspaceCleanupErrorCode.KeepRequired),
        )

        expect(em.query).not.toHaveBeenCalled()
        expect(prune.prune).not.toHaveBeenCalled()
    })

    it("refuses a keep id that does not exist before reading the accounts, and deletes nothing", async () => {
        const { cleanup, prune, accounts } = await build({ workspaces: [SPA_ROW] })

        await expect(cleanup.run({ keep: HAKUEN, dryRun: true })).rejects.toEqual(
            refusedWith(WorkspaceCleanupErrorCode.KeepNotFound),
        )

        expect(accounts.listUsers).not.toHaveBeenCalled()
        expect(prune.prune).not.toHaveBeenCalled()
        expect(accounts.deleteUser).not.toHaveBeenCalled()
    })

    it("prints the dry-run receipt with its digest and deletes nothing", async () => {
        const { cleanup, em, prune, accounts, print, builders } = await build()

        const report = await cleanup.run({ keep: HAKUEN, dryRun: true })

        expect(report).toMatchObject({ mode: "dry-run", deletedUsers: [], remainingUsers: [] })
        expect(report.digest).toMatch(/^[0-9a-f]{64}$/)
        expect(report.receipt).toEqual({
            schema: "nivo/workspace-cleanup-receipt@1",
            keep: [{ id: HAKUEN, name: "HAKUEN" }],
            remove: [{ id: SPA, name: "Spa", rows: { leads: 2, workspace_members: 1 }, total: 3 }],
            orphanUsers: [{ id: ORPHAN.id, email: "s***@example.test", keptCascade: {} }],
            uncounted: ["job_outbox"],
            allowKeptCascade: false,
        })
        expect(print).toHaveBeenCalledWith(receiptLineOf(report))
        expect(em.find).toHaveBeenCalledWith(WorkspaceEntity, {
            select: { id: true, name: true },
            order: { id: "ASC" },
            take: 1000,
        })
        expect(em.query).toHaveBeenCalledWith(WORKSPACE_FOOTPRINT, [SPA])
        expect(em.query).not.toHaveBeenCalledWith(WORKSPACE_FOOTPRINT, [HAKUEN])
        expect(em.createQueryBuilder).toHaveBeenCalledTimes(2)
        expect(builders.map((fake) => fake.callsOf("where"))).toEqual([
            [["m.workspace_id = ANY(CAST(:keep AS uuid[]))", { keep: [HAKUEN] }]],
            [["w.id = ANY(CAST(:keep AS uuid[]))", { keep: [HAKUEN] }]],
        ])
        expect(builders.map((fake) => fake.callsOf("limit"))).toEqual([[[5000]], [[5000]]])
        expect(em.query).toHaveBeenCalledWith(WORKSPACE_USER_REFERENCES, [ORPHAN.id, [HAKUEN]])
        expect(prune.prune).not.toHaveBeenCalled()
        expect(accounts.deleteUser).not.toHaveBeenCalled()
    })

    it("refuses a removed workspace whose footprint the database does not answer", async () => {
        const { cleanup, em, prune } = await build({ users: [] })
        em.query.mockResolvedValue([])

        await expect(cleanup.run({ keep: HAKUEN, dryRun: true })).rejects.toEqual(
            refusedWith(WorkspaceCleanupErrorCode.FootprintInvalid),
        )
        expect(prune.prune).not.toHaveBeenCalled()
    })

    it("reads no references when every account is kept", async () => {
        const { cleanup, em } = await build({ users: [OWNER, STAFF] })

        const report = await cleanup.run({ keep: HAKUEN, dryRun: true })

        expect(report.receipt.orphanUsers).toEqual([])
        expect(em.query).not.toHaveBeenCalledWith(WORKSPACE_USER_REFERENCES, anything())
    })
})

describe("WorkspaceCleanupService references to kept data", () => {
    it("refuses in the dry run an account a kept row blocks, naming the users and tables", async () => {
        const blocked = { cascade: {}, block: { "lead_actions.requested_by": 2 } }
        const { cleanup, print } = await build({ refs: { [ORPHAN.id]: blocked } })

        await expect(cleanup.run({ keep: HAKUEN, dryRun: true, allowKeptCascade: true })).rejects.toEqual(
            refusedWith(WorkspaceCleanupErrorCode.UserReferenceBlocked, {
                users: ORPHAN.id,
                tables: "lead_actions.requested_by",
            }),
        )
        expect(print).not.toHaveBeenCalled()
    })

    it("refuses in the dry run an account whose delete cascades into kept rows, by default", async () => {
        const cascading = { cascade: { "app_commands.requested_by": 3 }, block: {} }
        const { cleanup } = await build({ refs: { [ORPHAN.id]: cascading } })

        await expect(cleanup.run({ keep: HAKUEN, dryRun: true })).rejects.toEqual(
            refusedWith(WorkspaceCleanupErrorCode.KeptCascadeRefused, {
                users: ORPHAN.id,
                tables: "app_commands.requested_by",
            }),
        )
    })

    it("with --allow-kept-cascade lists the kept rows in the receipt, so they are part of the digest", async () => {
        const fixture = { refs: { [ORPHAN.id]: { cascade: { "app_commands.requested_by": 3 }, block: {} } } }
        const { cleanup, prune, accounts } = await build(fixture)

        const report = await cleanup.run({ keep: HAKUEN, dryRun: true, allowKeptCascade: true })

        expect(report.receipt.allowKeptCascade).toBe(true)
        expect(report.receipt.orphanUsers).toEqual([
            { id: ORPHAN.id, email: "s***@example.test", keptCascade: { "app_commands.requested_by": 3 } },
        ])
        expect(report.digest).not.toBe(await digestOf({}, { allowKeptCascade: true }))
        expect(prune.prune).not.toHaveBeenCalled()
        expect(accounts.deleteUser).not.toHaveBeenCalled()
    })

    it("executes an allowed kept cascade only with the flag the digest was taken with", async () => {
        const fixture = { refs: { [ORPHAN.id]: { cascade: { "app_commands.requested_by": 3 }, block: {} } } }
        const digest = await digestOf(fixture, { allowKeptCascade: true })
        const { cleanup, accounts } = await build(fixture)

        const report = await cleanup.run({ keep: HAKUEN, execute: true, receiptDigest: digest, allowKeptCascade: true })

        expect(report.deletedUsers).toEqual([ORPHAN.id])
        expect(accounts.deleteUser).toHaveBeenCalledWith(ORPHAN.id)
    })
})

describe("WorkspaceCleanupService execute refusals", () => {
    it("refuses an execute whose digest is not the fresh dry run's, and deletes nothing", async () => {
        const { cleanup, prune, accounts } = await build()

        await expect(cleanup.run({ keep: HAKUEN, execute: true, receiptDigest: "b".repeat(64) })).rejects.toEqual(
            refusedWith(WorkspaceCleanupErrorCode.DigestMismatch),
        )

        expect(prune.prune).not.toHaveBeenCalled()
        expect(accounts.deleteUser).not.toHaveBeenCalled()
    })

    it("refuses an execute whose keep id no longer exists, before any delete", async () => {
        const digest = await digestOf()
        const { cleanup, prune, accounts } = await build({ workspaces: [SPA_ROW] })

        await expect(cleanup.run({ keep: HAKUEN, execute: true, receiptDigest: digest })).rejects.toEqual(
            refusedWith(WorkspaceCleanupErrorCode.KeepNotFound),
        )

        expect(prune.prune).not.toHaveBeenCalled()
        expect(accounts.deleteUser).not.toHaveBeenCalled()
    })

    it("refuses an execute when a blocking reference appeared since the review, before any delete", async () => {
        const digest = await digestOf()
        const blocked = { cascade: {}, block: { "lead_actions.requested_by": 1 } }
        const { cleanup, prune, accounts } = await build({ refs: { [ORPHAN.id]: blocked } })

        await expect(cleanup.run({ keep: HAKUEN, execute: true, receiptDigest: digest })).rejects.toEqual(
            refusedWith(WorkspaceCleanupErrorCode.UserReferenceBlocked),
        )

        expect(prune.prune).not.toHaveBeenCalled()
        expect(accounts.deleteUser).not.toHaveBeenCalled()
    })
})

describe("WorkspaceCleanupService execute", () => {
    it("on a matching digest prunes all but the kept workspace, then deletes only the orphan accounts", async () => {
        const digest = await digestOf()
        const { cleanup, prune, accounts, print } = await build()

        const report = await cleanup.run({ keep: HAKUEN, execute: true, receiptDigest: digest.toUpperCase() })

        expect(report).toMatchObject({ mode: "execute", digest, deletedUsers: [ORPHAN.id], remainingUsers: [] })
        expect(prune.prune).toHaveBeenCalledWith({ keep: [HAKUEN], default: false, yes: true }, anything())
        expect(prune.prune.mock.invocationCallOrder[0]).toBeLessThan(
            accounts.deleteUser.mock.invocationCallOrder[0] ?? 0,
        )
        expect(accounts.deleteUser).toHaveBeenCalledTimes(1)
        expect(accounts.deleteUser).not.toHaveBeenCalledWith(OWNER.id)
        expect(accounts.deleteUser).not.toHaveBeenCalledWith(STAFF.id)
        expect(print).toHaveBeenCalledWith(`  deleted account ${ORPHAN.id}`)
        expect(print).toHaveBeenCalledWith(receiptLineOf(report))
    })

    it("hands the prune a terminal that prints through the cleanup and never confirms by itself", async () => {
        const digest = await digestOf()
        const { cleanup, prune, print } = await build()

        await cleanup.run({ keep: HAKUEN, execute: true, receiptDigest: digest })
        const terminal = prune.prune.mock.calls[0]?.[1]
        terminal?.print("  deleted Spa")

        expect(print).toHaveBeenCalledWith("  deleted Spa")
        await expect(terminal?.ask("Type DELETE: ")).resolves.toBe("")
    })
})

describe("WorkspaceCleanupService execute stops at a failed account", () => {
    const users = [OWNER, { id: "u-a" }, { id: "u-b" }, { id: "u-c" }]

    it.each<[string, () => Promise<CleanupUserDeleted>]>([
        ["an Auth refusal", () => Promise.resolve({ error: { message: "user has rows" } })],
        ["a thrown error", () => Promise.reject(new Error("user has rows"))],
        ["a thrown value", () => Promise.reject("user has rows")],
    ])("stops at %s and reports the accounts deleted and remaining", async (_label, failure) => {
        const digest = await digestOf({ users })
        const { cleanup, accounts, print } = await build({ users })
        accounts.deleteUser.mockResolvedValueOnce({ error: null }).mockImplementationOnce(failure)

        await expect(cleanup.run({ keep: HAKUEN, execute: true, receiptDigest: digest })).rejects.toEqual(
            refusedWith(WorkspaceCleanupErrorCode.UserDeleteFailed, { deleted: 1, remaining: "u-b,u-c" }),
        )

        expect(accounts.deleteUser).toHaveBeenCalledTimes(2)
        expect(accounts.deleteUser).not.toHaveBeenCalledWith("u-c")
        expect(print).toHaveBeenCalledWith("  FAILED account u-b: user has rows")
        expect(print).toHaveBeenCalledWith(stringLike('"deletedUsers":["u-a"],"remainingUsers":["u-b","u-c"]'))
    })

    it("is safe to re-run: the fresh survey finds only what is left, and the run finishes it", async () => {
        const left = { users: [OWNER, { id: "u-b" }, { id: "u-c" }], workspaces: [KEPT_ROW] }
        const digest = await digestOf(left)
        const { cleanup, prune, accounts } = await build(left)

        const report = await cleanup.run({ keep: HAKUEN, execute: true, receiptDigest: digest })

        expect(report.receipt.remove).toEqual([])
        expect(report.deletedUsers).toEqual(["u-b", "u-c"])
        expect(prune.prune).toHaveBeenCalledTimes(1)
        expect(accounts.deleteUser).toHaveBeenCalledTimes(2)
    })
})

describe("WorkspaceCleanupService scans", () => {
    it("reads every page of accounts", async () => {
        const page = Array.from({ length: 200 }, (_, index) => ({ id: `u-${String(index).padStart(3, "0")}` }))
        const { cleanup, accounts } = await build({ users: [...page, OWNER] })
        accounts.listUsers
            .mockResolvedValueOnce({ data: { users: page }, error: null })
            .mockResolvedValueOnce({ data: { users: [OWNER] }, error: null })

        const report = await cleanup.run({ keep: HAKUEN, dryRun: true })

        expect(accounts.listUsers).toHaveBeenNthCalledWith(2, { page: 2, perPage: 200 })
        expect(report.receipt.orphanUsers).toHaveLength(200)
    })

    it("refuses when Auth fails to list the accounts", async () => {
        const { cleanup, accounts } = await build()
        accounts.listUsers.mockResolvedValue({ data: { users: [] }, error: { message: "down" } })

        await expect(cleanup.run({ keep: HAKUEN, dryRun: true })).rejects.toEqual(
            refusedWith(WorkspaceCleanupErrorCode.AuthFailed),
        )
    })

    it("refuses an account scan that does not reach its end", async () => {
        const page = Array.from({ length: 200 }, (_, index) => ({ id: `u-${index}` }))
        const { cleanup, accounts } = await build()
        accounts.listUsers.mockResolvedValue({ data: { users: page }, error: null })

        await expect(cleanup.run({ keep: HAKUEN, dryRun: true })).rejects.toEqual(
            refusedWith(WorkspaceCleanupErrorCode.ScanIncomplete),
        )
        expect(accounts.listUsers).toHaveBeenCalledTimes(50)
    })

    it.each<[string, Fixture]>([
        ["workspace", { workspaces: Array.from({ length: 1000 }, () => KEPT_ROW) }],
        ["kept account", { kept: Array.from({ length: 5000 }, (_, index) => ({ user_id: `u-${index}` })) }],
    ])("refuses a %s read that reaches its bound", async (_label, fixture) => {
        const { cleanup, accounts } = await build(fixture)

        await expect(cleanup.run({ keep: HAKUEN, dryRun: true })).rejects.toEqual(
            refusedWith(WorkspaceCleanupErrorCode.ScanIncomplete),
        )
        expect(accounts.listUsers).not.toHaveBeenCalled()
    })
})
