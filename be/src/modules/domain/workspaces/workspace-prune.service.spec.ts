import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { OPENCLAW_GATEWAY_ADMIN } from "@modules/integrations/openclaw"
import type { GatewayAdminClient } from "@modules/integrations/openclaw"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { isRecord } from "@modules/platform/primitives"
import { WorkspacesErrorCode } from "./errors/workspaces.error"
import { WorkspaceEntity } from "./persistence/entities"
import { WorkspacePruneService } from "./workspace-prune.service"
import { NIVO_WORKSPACE_ID } from "./workspaces.contracts"

const NIVO = { id: NIVO_WORKSPACE_ID, name: "NIVO", plan_code: "pro", status: "active" }
const SPA = { id: "ws-spa", name: "Spa", plan_code: null, status: "pending_payment" }
const BUN = { id: "ws-bun", name: "Bun", plan_code: "starter", status: "past_due" }

/** The stored workspaces a brief list stands for. */
const storedOf = (...briefs: ReadonlyArray<typeof NIVO | typeof SPA | typeof BUN>): Array<WorkspaceEntity> =>
    briefs.map((brief) =>
        Object.assign(new WorkspaceEntity(), {
            id: brief.id,
            name: brief.name,
            planCode: brief.plan_code,
            status: brief.status,
        }),
    )

const DELETED = { affected: 1, raw: [] }

const build = async (em: MockEntityManager, answer = "DELETE", enabled = false) => {
    const terminal = { print: jest.fn(), ask: jest.fn().mockResolvedValue(answer) }
    const openclaw = mock<GatewayAdminClient>({ enabled })
    const moduleRef = await Test.createTestingModule({
        providers: [
            WorkspacePruneService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: OPENCLAW_GATEWAY_ADMIN, useValue: openclaw },
        ],
    }).compile()
    return { prune: moduleRef.get(WorkspacePruneService), terminal, openclaw }
}

/** The terminal double a spec reads the printed lines from. */
interface TerminalDouble {
    print: jest.Mock
}

const printed = (terminal: TerminalDouble): Array<string> => terminal.print.mock.calls.map(([line]) => String(line))

describe("WorkspacePruneService", () => {
    it("keeps the built-in workspace, lists both sides, asks, deletes the rest and counts what is left", async () => {
        const em = mockEntityManager({
            find: [WorkspaceEntity, storedOf(NIVO, SPA, BUN)],
            delete: [WorkspaceEntity, DELETED],
            count: [WorkspaceEntity, 1],
        })
        const { prune, terminal } = await build(em)

        const report = await prune.prune({}, terminal)

        expect(report).toEqual({ status: "deleted", kept: [NIVO], doomed: [SPA, BUN], left: 1 })
        expect(em.find).toHaveBeenCalledWith(WorkspaceEntity, {
            select: { id: true, name: true, planCode: true, status: true },
            order: { createdAt: "ASC" },
            take: 1000,
        })
        expect(terminal.ask).toHaveBeenCalledWith("Type DELETE to permanently delete these 2 workspaces: ")
        expect(em.delete).toHaveBeenCalledWith(WorkspaceEntity, { id: "ws-spa" })
        expect(em.delete).toHaveBeenCalledWith(WorkspaceEntity, { id: "ws-bun" })
        expect(printed(terminal)).toEqual([
            "KEEP:",
            `  NIVO  (pro)  ${NIVO_WORKSPACE_ID}`,
            "DELETE (2):",
            "  Spa  (no plan, pending_payment)  ws-spa",
            "  Bun  (starter, past_due)  ws-bun",
            "  no OpenClaw gateway here: agents of Spa not checked",
            "  deleted Spa",
            "  no OpenClaw gateway here: agents of Bun not checked",
            "  deleted Bun",
            "Done. 2 deleted, 0 failed, 1 workspace(s) left.",
        ])
    })

    it("skips the question with the yes flag and keeps the extra workspaces named", async () => {
        const em = mockEntityManager({
            find: [WorkspaceEntity, storedOf(NIVO, SPA, BUN)],
            delete: [WorkspaceEntity, DELETED],
            count: [WorkspaceEntity, 0],
        })
        const { prune, terminal } = await build(em)

        const report = await prune.prune({ keep: ["ws-spa"], yes: true }, terminal)

        expect(report.kept).toEqual([NIVO, SPA])
        expect(report.doomed).toEqual([BUN])
        expect(report.left).toBe(0)
        expect(terminal.ask).not.toHaveBeenCalled()
    })

    it("drops the built-in workspace with no-default, which then needs a workspace to keep", async () => {
        const em = mockEntityManager({ find: [WorkspaceEntity, storedOf(SPA)] })
        const { prune, terminal } = await build(em)

        await expect(prune.prune({ default: false }, terminal)).rejects.toMatchObject({
            code: WorkspacesErrorCode.NothingToKeep,
        })
        expect(em.find).not.toHaveBeenCalled()
    })

    it("deletes nothing when a workspace to keep does not exist", async () => {
        const em = mockEntityManager({ find: [WorkspaceEntity, storedOf(SPA)] })
        const { prune, terminal } = await build(em)

        await expect(prune.prune({ default: false, keep: ["ws-gone"] }, terminal)).rejects.toMatchObject({
            code: WorkspacesErrorCode.KeepNotFound,
        })
        expect(printed(terminal)).toEqual(["KEEP:"])
    })
})

describe("WorkspacePruneService", () => {
    it("says so when there is nothing to delete", async () => {
        const em = mockEntityManager({ find: [WorkspaceEntity, storedOf(NIVO)] })
        const { prune, terminal } = await build(em)

        await expect(prune.prune({}, terminal)).resolves.toEqual({
            status: "nothing-to-delete",
            kept: [NIVO],
            doomed: [],
            left: 1,
        })
        expect(printed(terminal).at(-1)).toBe("Nothing to delete.")
        expect(terminal.ask).not.toHaveBeenCalled()
    })

    it("deletes nothing when the operator does not type the confirmation word", async () => {
        const em = mockEntityManager({ find: [WorkspaceEntity, storedOf(NIVO, SPA)] })
        const { prune, terminal } = await build(em, "no")

        await expect(prune.prune({}, terminal)).resolves.toMatchObject({ status: "cancelled", left: 2 })
        expect(printed(terminal).at(-1)).toBe("Cancelled. Nothing deleted.")
        expect(em.delete).not.toHaveBeenCalled()
    })

    it.each([
        ["an error", new Error("fk violation"), "fk violation"],
        ["a plain value", "locked", "locked"],
    ])("goes on after a delete fails with %s and fails the run at the end", async (_name, cause, message) => {
        const em = mockEntityManager({
            find: [WorkspaceEntity, storedOf(NIVO, SPA, BUN)],
            count: [WorkspaceEntity, 2],
        })
        em.delete.mockImplementation((_target, criteria) =>
            isRecord(criteria) && criteria.id === "ws-spa" ? Promise.reject(cause) : Promise.resolve(DELETED),
        )
        const { prune, terminal } = await build(em)

        await expect(prune.prune({ yes: true }, terminal)).rejects.toMatchObject({
            code: WorkspacesErrorCode.DeleteFailed,
            params: { failed: 1 },
        })
        expect(printed(terminal)).toEqual(
            expect.arrayContaining([
                `  FAILED Spa: ${message}`,
                "  deleted Bun",
                "Done. 1 deleted, 1 failed, 2 workspace(s) left.",
            ]),
        )
    })
})

describe("WorkspacePruneService OpenClaw agents", () => {
    it("removes the OpenClaw agents of a workspace before its rows", async () => {
        const em = mockEntityManager({
            find: [WorkspaceEntity, storedOf(NIVO, SPA)],
            delete: [WorkspaceEntity, DELETED],
            count: [WorkspaceEntity, 1],
        })
        const { prune, terminal, openclaw } = await build(em, "DELETE", true)
        openclaw.removeWorkspaceAgents.mockResolvedValue(["ws-spa-sales", "ws-spa-nivo"])

        await prune.prune({ yes: true }, terminal)

        expect(openclaw.removeWorkspaceAgents).toHaveBeenCalledWith(SPA.id)
        expect(openclaw.removeWorkspaceAgents.mock.invocationCallOrder[0]).toBeLessThan(
            em.delete.mock.invocationCallOrder[0] ?? 0,
        )
        expect(printed(terminal)).toContain("  removed 2 OpenClaw agent(s) of Spa")
    })

    it("keeps a workspace whose agents could not be removed, so a rerun retries it", async () => {
        const em = mockEntityManager({ find: [WorkspaceEntity, storedOf(NIVO, SPA)], count: [WorkspaceEntity, 2] })
        const { prune, terminal, openclaw } = await build(em, "DELETE", true)
        openclaw.removeWorkspaceAgents.mockRejectedValue(new Error("gateway down"))

        await expect(prune.prune({ yes: true }, terminal)).rejects.toMatchObject({
            code: WorkspacesErrorCode.DeleteFailed,
        })

        expect(em.delete).not.toHaveBeenCalled()
        expect(printed(terminal)).toContain("  FAILED Spa: gateway down")
    })

    it("says so and still deletes where no gateway is configured", async () => {
        const em = mockEntityManager({
            find: [WorkspaceEntity, storedOf(NIVO, SPA)],
            delete: [WorkspaceEntity, DELETED],
            count: [WorkspaceEntity, 1],
        })
        const { prune, terminal, openclaw } = await build(em)

        await prune.prune({ yes: true }, terminal)

        expect(openclaw.removeWorkspaceAgents).not.toHaveBeenCalled()
        expect(printed(terminal)).toContain("  no OpenClaw gateway here: agents of Spa not checked")
        expect(em.delete).toHaveBeenCalledWith(WorkspaceEntity, { id: SPA.id })
    })
})
