import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { WorkspacesErrorCode } from "./errors/workspaces.error"
import { COUNT_ALL_WORKSPACES, DELETE_ONE_WORKSPACE, LIST_ALL_WORKSPACES } from "./persistence/workspace-prune.sql"
import { WorkspacePruneService } from "./workspace-prune.service"
import { NIVO_WORKSPACE_ID } from "./workspaces.contracts"

const NIVO = { id: NIVO_WORKSPACE_ID, name: "NIVO", plan_code: "pro", status: "active" }
const SPA = { id: "ws-spa", name: "Spa", plan_code: null, status: "pending_payment" }
const BUN = { id: "ws-bun", name: "Bun", plan_code: "starter", status: "past_due" }

const build = async (em: MockEntityManager, answer = "DELETE") => {
    const terminal = { print: jest.fn(), ask: jest.fn().mockResolvedValue(answer) }
    const moduleRef = await Test.createTestingModule({
        providers: [WorkspacePruneService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
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
            query: [
                [LIST_ALL_WORKSPACES, [NIVO, SPA, BUN]],
                [DELETE_ONE_WORKSPACE, []],
                [COUNT_ALL_WORKSPACES, [{ total: 1 }]],
            ],
        })
        const { prune, terminal } = await build(em)

        const report = await prune.prune({}, terminal)

        expect(report).toEqual({ status: "deleted", kept: [NIVO], doomed: [SPA, BUN], left: 1 })
        expect(terminal.ask).toHaveBeenCalledWith("Type DELETE to permanently delete these 2 workspaces: ")
        expect(em.query).toHaveBeenCalledWith(DELETE_ONE_WORKSPACE, ["ws-spa"])
        expect(em.query).toHaveBeenCalledWith(DELETE_ONE_WORKSPACE, ["ws-bun"])
        expect(printed(terminal)).toEqual([
            "KEEP:",
            `  NIVO  (pro)  ${NIVO_WORKSPACE_ID}`,
            "DELETE (2):",
            "  Spa  (no plan, pending_payment)  ws-spa",
            "  Bun  (starter, past_due)  ws-bun",
            "  deleted Spa",
            "  deleted Bun",
            "Done. 2 deleted, 0 failed, 1 workspace(s) left.",
        ])
    })

    it("skips the question with the yes flag and keeps the extra workspaces named", async () => {
        const em = mockEntityManager({
            query: [
                [LIST_ALL_WORKSPACES, [NIVO, SPA, BUN]],
                [DELETE_ONE_WORKSPACE, []],
                [COUNT_ALL_WORKSPACES, []],
            ],
        })
        const { prune, terminal } = await build(em)

        const report = await prune.prune({ keep: ["ws-spa"], yes: true }, terminal)

        expect(report.kept).toEqual([NIVO, SPA])
        expect(report.doomed).toEqual([BUN])
        expect(report.left).toBe(0)
        expect(terminal.ask).not.toHaveBeenCalled()
    })

    it("drops the built-in workspace with no-default, which then needs a workspace to keep", async () => {
        const em = mockEntityManager({ query: [LIST_ALL_WORKSPACES, [SPA]] })
        const { prune, terminal } = await build(em)

        await expect(prune.prune({ default: false }, terminal)).rejects.toMatchObject({
            code: WorkspacesErrorCode.NothingToKeep,
        })
        expect(em.query).not.toHaveBeenCalled()
    })

    it("deletes nothing when a workspace to keep does not exist", async () => {
        const em = mockEntityManager({ query: [LIST_ALL_WORKSPACES, [SPA]] })
        const { prune, terminal } = await build(em)

        await expect(prune.prune({ default: false, keep: ["ws-gone"] }, terminal)).rejects.toMatchObject({
            code: WorkspacesErrorCode.KeepNotFound,
        })
        expect(printed(terminal)).toEqual(["KEEP:"])
    })

    it("says so when there is nothing to delete", async () => {
        const em = mockEntityManager({ query: [LIST_ALL_WORKSPACES, [NIVO]] })
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
        const em = mockEntityManager({ query: [LIST_ALL_WORKSPACES, [NIVO, SPA]] })
        const { prune, terminal } = await build(em, "no")

        await expect(prune.prune({}, terminal)).resolves.toMatchObject({ status: "cancelled", left: 2 })
        expect(printed(terminal).at(-1)).toBe("Cancelled. Nothing deleted.")
        expect(em.query).not.toHaveBeenCalledWith(DELETE_ONE_WORKSPACE, expect.anything())
    })

    it.each([
        ["an error", new Error("fk violation"), "fk violation"],
        ["a plain value", "locked", "locked"],
    ])("goes on after a delete fails with %s and fails the run at the end", async (_name, cause, message) => {
        const em = mockEntityManager({
            query: [
                [LIST_ALL_WORKSPACES, [NIVO, SPA, BUN]],
                [DELETE_ONE_WORKSPACE, []],
                [COUNT_ALL_WORKSPACES, [{ total: 2 }]],
            ],
        })
        em.query.mockImplementation((text: string, params?: Array<unknown>) => {
            if (text === DELETE_ONE_WORKSPACE && params?.[0] === "ws-spa") return Promise.reject(cause)
            if (text === LIST_ALL_WORKSPACES) return Promise.resolve([NIVO, SPA, BUN])
            return Promise.resolve(text === COUNT_ALL_WORKSPACES ? [{ total: 2 }] : [])
        })
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
