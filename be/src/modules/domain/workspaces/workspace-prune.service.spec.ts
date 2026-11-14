import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { IsNull, type UpdateResult } from "typeorm"
import { CLOCK } from "@modules/platform/clock"
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

const DELETED: UpdateResult = { affected: 1, raw: [], generatedMaps: [] }
const NOW = new Date("2026-11-14T04:00:00.000Z")

const build = async (em: MockEntityManager, answer = "DELETE") => {
    const terminal = { print: jest.fn(), ask: jest.fn().mockResolvedValue(answer) }
    const moduleRef = await Test.createTestingModule({
        providers: [
            WorkspacePruneService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: CLOCK, useValue: { now: () => NOW } },
        ],
    }).compile()
    return { prune: moduleRef.get(WorkspacePruneService), terminal }
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
            update: [WorkspaceEntity, DELETED],
            count: [WorkspaceEntity, 1],
        })
        const { prune, terminal } = await build(em)

        const report = await prune.prune({}, terminal)

        expect(report).toEqual({ status: "deleted", kept: [NIVO], doomed: [SPA, BUN], left: 1 })
        expect(em.find).toHaveBeenCalledWith(WorkspaceEntity, {
            select: { id: true, name: true, planCode: true, status: true },
            where: { deletedAt: IsNull() },
            order: { createdAt: "ASC" },
            take: 1000,
        })
        expect(terminal.ask).toHaveBeenCalledWith("Type DELETE to delete these 2 workspaces (soft delete: nothing is removed, every read hides them): ")
        expect(em.update).toHaveBeenCalledWith(WorkspaceEntity, { id: "ws-spa", deletedAt: IsNull() }, { deletedAt: NOW })
        expect(em.update).toHaveBeenCalledWith(WorkspaceEntity, { id: "ws-bun", deletedAt: IsNull() }, { deletedAt: NOW })
        expect(em.delete).not.toHaveBeenCalled()
        expect(printed(terminal)).toEqual([
            "KEEP:",
            `  NIVO  (pro)  ${NIVO_WORKSPACE_ID}`,
            "DELETE, softly (2):",
            "  Spa  (no plan, pending_payment)  ws-spa",
            "  Bun  (starter, past_due)  ws-bun",
            "  deleted (soft) Spa",
            "  deleted (soft) Bun",
            "Done. 2 deleted, 0 failed, 1 workspace(s) left.",
        ])
    })

    it("skips the question with the yes flag and keeps the extra workspaces named", async () => {
        const em = mockEntityManager({
            find: [WorkspaceEntity, storedOf(NIVO, SPA, BUN)],
            update: [WorkspaceEntity, DELETED],
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
        expect(em.update).not.toHaveBeenCalled()
    })

    it.each([
        ["an error", new Error("fk violation"), "fk violation"],
        ["a plain value", "locked", "locked"],
    ])("goes on after a delete fails with %s and fails the run at the end", async (_name, cause, message) => {
        const em = mockEntityManager({
            find: [WorkspaceEntity, storedOf(NIVO, SPA, BUN)],
            count: [WorkspaceEntity, 2],
        })
        em.update.mockImplementation((_target, criteria) =>
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
                "  deleted (soft) Bun",
                "Done. 1 deleted, 1 failed, 2 workspace(s) left.",
            ]),
        )
    })
})

describe("WorkspacePruneService without an agent runtime", () => {
    it("marks a workspace deleted by its row alone: its agents and their history stay, nothing cascades", async () => {
        const em = mockEntityManager({
            find: [WorkspaceEntity, storedOf(NIVO, SPA)],
            update: [WorkspaceEntity, DELETED],
            count: [WorkspaceEntity, 1],
        })
        const { prune, terminal } = await build(em)

        await expect(prune.prune({ yes: true }, terminal)).resolves.toMatchObject({ status: "deleted", left: 1 })

        expect(em.update).toHaveBeenCalledTimes(1)
        expect(em.update).toHaveBeenCalledWith(WorkspaceEntity, { id: SPA.id, deletedAt: IsNull() }, { deletedAt: NOW })
        expect(em.delete).not.toHaveBeenCalled()
        expect(printed(terminal)).toEqual([
            "KEEP:",
            `  NIVO  (pro)  ${NIVO_WORKSPACE_ID}`,
            "DELETE, softly (1):",
            "  Spa  (no plan, pending_payment)  ws-spa",
            "  deleted (soft) Spa",
            "Done. 1 deleted, 0 failed, 1 workspace(s) left.",
        ])
    })
})
