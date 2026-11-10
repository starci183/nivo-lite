import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { runViewOf } from "@tests/fixtures/builders/agent-runs.builder"
import { AgentRunCancelService } from "./agent-run-cancel.service"
import { AgentRunStoreService } from "./agent-run-store.service"
import type { OwnerCancelRequest, RunCancelResult, RunView } from "./agent-runs-engine.contracts"

const REQUEST: OwnerCancelRequest = { principalId: "user-1", workspaceId: "ws-1", runId: "run-1" }

/** The refusal the members door answers for a seat that does not govern the workspace. */
const ROLE_FORBIDDEN = "WORKSPACE_MEMBERS_ROLE_FORBIDDEN"

const build = async (run: RunView | null, result: RunCancelResult = { kind: "cancelled" }) => {
    const members = mock<WorkspaceMembersService>()
    members.require.mockResolvedValue({
        userId: "user-1",
        workspaceId: "ws-1",
        role: "manager",
        staffId: null,
        displayName: "Lan",
        status: "active",
    })
    members.idOf.mockResolvedValue("member-1")
    const runs = mock<AgentRunStoreService>()
    runs.runById.mockResolvedValue(run)
    runs.cancel.mockResolvedValue(result)
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentRunCancelService,
            { provide: WorkspaceMembersService, useValue: members },
            { provide: AgentRunStoreService, useValue: runs },
        ],
    }).compile()
    return { service: moduleRef.get(AgentRunCancelService), members, runs }
}

describe("AgentRunCancelService", () => {
    it("cancels the run under the seat of the owner or manager and says the effects already sent are kept", async () => {
        const { service, members, runs } = await build(runViewOf())

        await expect(service.cancel(REQUEST)).resolves.toEqual({ kind: "cancelled", note: "effects_kept" })
        expect(members.require).toHaveBeenCalledWith("user-1", "ws-1", ["owner", "manager"])
        expect(runs.cancel).toHaveBeenCalledWith("ws-1", "run-1", "member-1")
    })

    it("answers a run of another workspace, and a run that does not exist, as not found, and cancels nothing", async () => {
        const other = await build(runViewOf({ workspaceId: "ws-2" }))
        const missing = await build(null)

        await expect(other.service.cancel(REQUEST)).resolves.toEqual({ kind: "not_found", note: null })
        await expect(missing.service.cancel(REQUEST)).resolves.toEqual({ kind: "not_found", note: null })
        expect(other.runs.cancel).not.toHaveBeenCalled()
        expect(missing.runs.cancel).not.toHaveBeenCalled()
    })

    it("says why a run was not cancelled, with no note", async () => {
        const ended = await build(runViewOf(), { kind: "not_cancellable" })
        const again = await build(runViewOf(), { kind: "already_cancelled" })

        await expect(ended.service.cancel(REQUEST)).resolves.toEqual({ kind: "not_cancellable", note: null })
        await expect(again.service.cancel(REQUEST)).resolves.toEqual({ kind: "already_cancelled", note: null })
    })

    it("refuses a seat that does not govern the workspace before it reads the run", async () => {
        const { service, members, runs } = await build(runViewOf())
        members.require.mockRejectedValue(Object.assign(new Error("not allowed"), { code: ROLE_FORBIDDEN }))

        await expect(service.cancel(REQUEST)).rejects.toMatchObject({ code: ROLE_FORBIDDEN })
        expect(runs.runById).not.toHaveBeenCalled()
        expect(runs.cancel).not.toHaveBeenCalled()
    })
})
