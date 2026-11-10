import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { runViewOf } from "@tests/fixtures/builders/agent-runs.builder"
import { AgentRunOwnerResumeService } from "./agent-run-owner-resume.service"
import { AgentRunResumeService } from "./agent-run-resume.service"
import { AgentRunStoreService } from "./agent-run-store.service"
import { AgentRunsViewService } from "./agent-runs-view.service"
import type { RunEngine } from "./agent-runs-view.contracts"
import type { OwnerResumeRequest, RunView } from "./agent-runs-engine.contracts"

const REQUEST: OwnerResumeRequest = {
    principalId: "user-1",
    workspaceId: "ws-1",
    runId: "run-1",
    reason: "fixed the price",
}

/** The refusal the members door answers for a seat that does not govern the workspace. */
const ROLE_FORBIDDEN = "WORKSPACE_MEMBERS_ROLE_FORBIDDEN"

const runOf = (workspaceId: string): RunView => runViewOf({ workspaceId, status: "dead" })

const build = async (run: RunView | null, engine: RunEngine = "legacy") => {
    const members = mock<WorkspaceMembersService>()
    members.require.mockResolvedValue({
        userId: "user-1",
        workspaceId: "ws-1",
        role: "owner",
        staffId: null,
        displayName: "Lan",
        status: "active",
    })
    members.idOf.mockResolvedValue("member-1")
    const runs = mock<AgentRunStoreService>()
    runs.runById.mockResolvedValue(run)
    const resumes = mock<AgentRunResumeService>()
    resumes.resume.mockResolvedValue({ kind: "resumed", stepKey: "turn", workspaceId: "ws-1" })
    const view = mock<AgentRunsViewService>()
    view.detail.mockImplementation((_ws, _agent, runId) =>
        Promise.resolve(run === null ? null : { run: { id: runId } as never, engine, steps: [] }),
    )
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentRunOwnerResumeService,
            { provide: WorkspaceMembersService, useValue: members },
            { provide: AgentRunStoreService, useValue: runs },
            { provide: AgentRunResumeService, useValue: resumes },
            { provide: AgentRunsViewService, useValue: view },
        ],
    }).compile()
    return { service: moduleRef.get(AgentRunOwnerResumeService), members, runs, resumes }
}

describe("AgentRunOwnerResumeService", () => {
    it("runs the parked run of the workspace again under the seat of the owner or manager, with their reason", async () => {
        const { service, members, resumes } = await build(runOf("ws-1"))

        await expect(service.resume(REQUEST)).resolves.toEqual({ kind: "resumed", stepKey: "turn" })
        expect(members.require).toHaveBeenCalledWith("user-1", "ws-1", ["owner", "manager"])
        expect(resumes.resume).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            runId: "run-1",
            actor: "member-1",
            reason: "fixed the price",
        })
    })

    it("answers a run of another workspace, and a run that does not exist, as not found, and resumes nothing", async () => {
        const other = await build(runOf("ws-2"))
        const missing = await build(null)

        await expect(other.service.resume(REQUEST)).resolves.toEqual({ kind: "not_found", stepKey: null })
        await expect(missing.service.resume(REQUEST)).resolves.toEqual({ kind: "not_found", stepKey: null })
        expect(other.resumes.resume).not.toHaveBeenCalled()
        expect(missing.resumes.resume).not.toHaveBeenCalled()
    })

    it("answers why a run was not resumed, with no step", async () => {
        const { service, resumes } = await build(runOf("ws-1"))
        resumes.resume.mockResolvedValue({ kind: "outcome_unknown" })

        await expect(service.resume(REQUEST)).resolves.toEqual({ kind: "outcome_unknown", stepKey: null })
    })

    it("refuses a run on a LangGraph thread with thread_run: the old resume would write a step the thread does not have", async () => {
        const { service, resumes } = await build(runOf("ws-1"), "langgraph")

        await expect(service.resume(REQUEST)).resolves.toEqual({ kind: "thread_run", stepKey: null })
        expect(resumes.resume).not.toHaveBeenCalled()
    })

    it("refuses a seat that does not govern the workspace before it reads the run", async () => {
        const { service, members, runs } = await build(runOf("ws-1"))
        members.require.mockRejectedValue(Object.assign(new Error("not allowed"), { code: ROLE_FORBIDDEN }))

        await expect(service.resume(REQUEST)).rejects.toMatchObject({ code: ROLE_FORBIDDEN })
        expect(runs.runById).not.toHaveBeenCalled()
    })
})
