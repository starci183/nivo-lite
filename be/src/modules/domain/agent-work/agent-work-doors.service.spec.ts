import { mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import type { InstallationRecord } from "@modules/domain/module-installations"
import { AgentGoalsService } from "./agent-goals.service"
import { AgentTasksService } from "./agent-tasks.service"
import { AgentTriggersService } from "./agent-triggers.service"
import { AgentWorkAccessService } from "./agent-work-access.service"
import { AgentWorkDoorsService } from "./agent-work-doors.service"
import { AgentWorkReadService } from "./agent-work-read.service"
import { AgentWorkSettingsService } from "./agent-work-settings.service"
import { AgentWorkErrorCode } from "./errors/agent-work.error"
import type { AgentGoalDraft, AgentTriggerDraft } from "./agent-work.contracts"

const installationOf = (agentId: string | null): InstallationRecord => ({
    id: "inst-1",
    workspaceId: "ws-1",
    moduleKey: "accounting",
    name: "Accounting",
    isMulti: false,
    agentId,
    status: "ready",
    operatingMode: "assist",
    liveEnabled: false,
    activeContextVersionId: null,
    settings: {},
    createdAt: "2026-10-31T10:00:00.000Z",
})

const GOAL: AgentGoalDraft = {
    workspaceId: "ws-1",
    installationId: "inst-1",
    goalId: null,
    title: "Collect",
    detail: "",
    status: "active",
    dueAt: null,
}

const TRIGGER: AgentTriggerDraft = {
    workspaceId: "ws-1",
    installationId: "inst-1",
    triggerId: null,
    kind: "schedule",
    preset: "hourly",
    atTime: null,
    timeZone: null,
    eventName: null,
    probeKey: null,
    enabled: true,
}

const build = async (installation: InstallationRecord | null = installationOf("agent-1")) => {
    const access = mock<AgentWorkAccessService>({
        manager: jest.fn().mockResolvedValue("member-1"),
        owner: jest.fn().mockResolvedValue("member-1"),
    })
    const installations = mock<InstallationRecordsService>({ find: jest.fn().mockResolvedValue(installation) })
    const read = mock<AgentWorkReadService>({
        agentWork: jest.fn().mockResolvedValue("work"),
        workspaceWork: jest.fn().mockResolvedValue("workspace"),
    })
    const settings = mock<AgentWorkSettingsService>({
        setAgentWork: jest.fn().mockResolvedValue("state"),
        setWorkspaceWork: jest.fn().mockResolvedValue("settings"),
    })
    const goals = mock<AgentGoalsService>({ save: jest.fn().mockResolvedValue("goal") })
    const triggers = mock<AgentTriggersService>({
        save: jest.fn().mockResolvedValue("trigger"),
        remove: jest.fn().mockResolvedValue(undefined),
    })
    const tasks = mock<AgentTasksService>({ drop: jest.fn().mockResolvedValue(undefined) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentWorkDoorsService,
            { provide: AgentWorkAccessService, useValue: access },
            { provide: InstallationRecordsService, useValue: installations },
            { provide: AgentWorkReadService, useValue: read },
            { provide: AgentWorkSettingsService, useValue: settings },
            { provide: AgentGoalsService, useValue: goals },
            { provide: AgentTriggersService, useValue: triggers },
            { provide: AgentTasksService, useValue: tasks },
        ],
    }).compile()
    return {
        doors: moduleRef.get(AgentWorkDoorsService),
        access,
        installations,
        read,
        settings,
        goals,
        triggers,
        tasks,
    }
}

describe("AgentWorkDoorsService > reads", () => {
    it("proves an owner or manager, then reads the work of the agent of the instance of that workspace", async () => {
        const { doors, access, installations, read } = await build()

        await expect(doors.agentWork("user-1", "ws-1", "inst-1")).resolves.toBe("work")

        expect(access.manager).toHaveBeenCalledWith("user-1", "ws-1")
        expect(installations.find).toHaveBeenCalledWith("ws-1", "inst-1")
        expect(read.agentWork).toHaveBeenCalledWith("ws-1", "agent-1")
    })

    it("refuses staff before it looks anything up", async () => {
        const { doors, access, installations, read } = await build()
        const refusal = new Error("role refused")
        access.manager.mockRejectedValue(refusal)

        await expect(doors.agentWork("user-1", "ws-1", "inst-1")).rejects.toBe(refusal)
        await expect(doors.workspaceWork("user-1", "ws-1")).rejects.toBe(refusal)
        expect(installations.find).not.toHaveBeenCalled()
        expect(read.agentWork).not.toHaveBeenCalled()
        expect(read.workspaceWork).not.toHaveBeenCalled()
    })

    it("reads the workspace switch for an owner or manager", async () => {
        const { doors, read } = await build()

        await expect(doors.workspaceWork("user-1", "ws-1")).resolves.toBe("workspace")
        expect(read.workspaceWork).toHaveBeenCalledWith("ws-1")
    })

    it("treats an instance of another workspace as unknown", async () => {
        const { doors, read } = await build(null)

        await expect(doors.agentWork("user-1", "ws-1", "foreign")).rejects.toMatchObject({
            code: AgentWorkErrorCode.AgentNotFound,
        })
        expect(read.agentWork).not.toHaveBeenCalled()
    })

    it("refuses an instance that drives no agent", async () => {
        const { doors } = await build(installationOf(null))

        await expect(doors.agentWork("user-1", "ws-1", "inst-1")).rejects.toMatchObject({
            code: AgentWorkErrorCode.AgentNotFound,
        })
    })
})

describe("AgentWorkDoorsService > switches", () => {
    it("asks for an owner, then switches the agent of the instance", async () => {
        const { doors, access, settings } = await build()

        await expect(doors.setAgentWork("user-1", "ws-1", "inst-1", false)).resolves.toBe("state")

        expect(access.owner).toHaveBeenCalledWith("user-1", "ws-1")
        expect(access.manager).not.toHaveBeenCalled()
        expect(settings.setAgentWork).toHaveBeenCalledWith("user-1", "ws-1", "agent-1", false)
    })

    it("refuses a manager at the owner's door, and an instance of another workspace", async () => {
        const { doors, access, settings } = await build()
        const refusal = new Error("owner only")
        access.owner.mockRejectedValue(refusal)

        await expect(doors.setAgentWork("user-1", "ws-1", "inst-1", true)).rejects.toBe(refusal)
        expect(settings.setAgentWork).not.toHaveBeenCalled()

        const foreign = await build(null)
        await expect(foreign.doors.setAgentWork("user-1", "ws-1", "x", true)).rejects.toMatchObject({
            code: AgentWorkErrorCode.AgentNotFound,
        })
        expect(foreign.settings.setAgentWork).not.toHaveBeenCalled()
    })

    it("hands the workspace switch to the settings, which prove the owner themselves", async () => {
        const { doors, settings } = await build()

        await expect(doors.setWorkspaceWork("user-1", "ws-1", true)).resolves.toBe("settings")
        expect(settings.setWorkspaceWork).toHaveBeenCalledWith("user-1", "ws-1", true)
    })
})

describe("AgentWorkDoorsService > goals, triggers and tasks", () => {
    it("writes a goal of the agent of the instance with the owner as its source", async () => {
        const { doors, access, goals } = await build()

        await expect(doors.saveGoal("user-1", GOAL)).resolves.toBe("goal")

        expect(access.manager).toHaveBeenCalledWith("user-1", "ws-1")
        expect(goals.save).toHaveBeenCalledWith("user-1", {
            workspaceId: "ws-1",
            agentId: "agent-1",
            goalId: null,
            title: "Collect",
            detail: "",
            status: "active",
            source: "owner",
            memberId: null,
            dueAt: null,
        })
    })

    it("writes a trigger of the agent of the instance", async () => {
        const { doors, triggers } = await build()

        await expect(doors.saveTrigger("user-1", TRIGGER)).resolves.toBe("trigger")

        expect(triggers.save).toHaveBeenCalledWith("user-1", {
            ...TRIGGER,
            agentId: "agent-1",
        })
    })

    it("removes a trigger and closes a task of the agent of the instance", async () => {
        const { doors, triggers, tasks } = await build()

        await doors.removeTrigger("user-1", "ws-1", "inst-1", "trigger-1")
        await doors.closeTask("user-1", "ws-1", "inst-1", "task-1")

        expect(triggers.remove).toHaveBeenCalledWith("user-1", "ws-1", "agent-1", "trigger-1")
        expect(tasks.drop).toHaveBeenCalledWith("user-1", "ws-1", "agent-1", "task-1")
    })

    it("refuses staff at every one of these doors and writes nothing", async () => {
        const { doors, access, goals, triggers, tasks } = await build()
        const refusal = new Error("role refused")
        access.manager.mockRejectedValue(refusal)

        await expect(doors.saveGoal("user-1", GOAL)).rejects.toBe(refusal)
        await expect(doors.saveTrigger("user-1", TRIGGER)).rejects.toBe(refusal)
        await expect(doors.removeTrigger("user-1", "ws-1", "inst-1", "t")).rejects.toBe(refusal)
        await expect(doors.closeTask("user-1", "ws-1", "inst-1", "t")).rejects.toBe(refusal)

        expect(goals.save).not.toHaveBeenCalled()
        expect(triggers.save).not.toHaveBeenCalled()
        expect(triggers.remove).not.toHaveBeenCalled()
        expect(tasks.drop).not.toHaveBeenCalled()
    })

    it("treats an instance of another workspace as unknown at every one of these doors", async () => {
        const { doors, goals, triggers, tasks } = await build(null)
        const unknown = { code: AgentWorkErrorCode.AgentNotFound }

        await expect(doors.saveGoal("user-1", GOAL)).rejects.toMatchObject(unknown)
        await expect(doors.saveTrigger("user-1", TRIGGER)).rejects.toMatchObject(unknown)
        await expect(doors.removeTrigger("user-1", "ws-1", "x", "t")).rejects.toMatchObject(unknown)
        await expect(doors.closeTask("user-1", "ws-1", "x", "t")).rejects.toMatchObject(unknown)

        expect(goals.save).not.toHaveBeenCalled()
        expect(triggers.remove).not.toHaveBeenCalled()
        expect(tasks.drop).not.toHaveBeenCalled()
    })
})
