import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { AgentsService } from "@modules/domain/agents"
import type { AgentSummary } from "@modules/domain/agents"
import { BrainCommandsService } from "@modules/domain/brain-commands"
import { BrainExtractionsService } from "@modules/domain/brain-extractions"
import { BrainFactsService } from "@modules/domain/brain-facts"
import { BrainLessonsService } from "@modules/domain/brain-lessons"
import { KnowledgeGapsService } from "@modules/domain/knowledge-gaps"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceMember, WorkspaceRole } from "@modules/domain/workspace-members"
import { BrainPageService } from "./brain-page.service"
import { BrainErrorCode } from "./errors/brain.error"

const USER = "user-1"
const WORKSPACE = "ws-1"

const agentOf = builder<AgentSummary>({
    id: "a-1",
    module: "booking",
    name: "Mai",
    handle: "mai",
    role: "Bookings",
    status: "active",
    createdAt: "2026-10-01T00:00:00Z",
})

const memberOf = (role: WorkspaceRole): WorkspaceMember => ({
    userId: USER,
    workspaceId: WORKSPACE,
    role,
    staffId: null,
    displayName: "Lan",
    status: "active",
})

const build = async (role: WorkspaceRole = "owner") => {
    const members = mock<WorkspaceMembersService>({ require: jest.fn(() => Promise.resolve(memberOf(role))) })
    const facts = mock<BrainFactsService>({ list: jest.fn(() => Promise.resolve([])) })
    const lessons = mock<BrainLessonsService>({ list: jest.fn(() => Promise.resolve([])) })
    const gaps = mock<KnowledgeGapsService>({
        list: jest.fn(() => Promise.resolve([])),
        countOpen: jest.fn(() => Promise.resolve(7)),
    })
    const extractions = mock<BrainExtractionsService>({ states: jest.fn(() => Promise.resolve([])) })
    const commands = mock<BrainCommandsService>()
    const agents = mock<AgentsService>({
        list: jest.fn(() =>
            Promise.resolve([
                agentOf(),
                agentOf({ id: "a-2", name: "Second booking agent" }),
                agentOf({ id: "a-3", module: "accounting", name: "Tam", status: "paused" }),
                agentOf({ id: "a-4", module: "unknown", name: "Ghost" }),
                agentOf({ id: "a-5", module: "accounting", name: "Kim" }),
            ]),
        ),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            BrainPageService,
            { provide: WorkspaceMembersService, useValue: members },
            { provide: BrainFactsService, useValue: facts },
            { provide: BrainLessonsService, useValue: lessons },
            { provide: KnowledgeGapsService, useValue: gaps },
            { provide: BrainExtractionsService, useValue: extractions },
            { provide: BrainCommandsService, useValue: commands },
            { provide: AgentsService, useValue: agents },
        ],
    }).compile()
    return { page: moduleRef.get(BrainPageService), members, facts, gaps, commands }
}

describe("BrainPageService", () => {
    describe("overview", () => {
        it("shows a manager the facts, the open questions and one lens per active agent module of the catalogue", async () => {
            const { page, facts, gaps } = await build("manager")

            const overview = await page.overview(USER, WORKSPACE)

            expect(overview).toEqual({
                facts: [],
                lessons: [],
                gaps: [],
                gapsOpen: 7,
                extractions: [],
                lenses: [
                    { module: "booking", name: "Mai", audience: "customer" },
                    { module: "accounting", name: "Kim", audience: "internal" },
                ],
            })
            expect(facts.list).toHaveBeenCalledWith(WORKSPACE, {
                statuses: ["active", "proposed", "scheduled"],
                limit: 2000,
            })
            expect(gaps.list).toHaveBeenCalledWith(WORKSPACE, ["open"], 50)
        })

        it("shows a staff member the lessons only", async () => {
            const { page, facts, gaps } = await build("staff")

            const overview = await page.overview(USER, WORKSPACE)

            expect(overview.gapsOpen).toBe(0)
            expect(overview.lenses).toHaveLength(2)
            expect(facts.list).not.toHaveBeenCalled()
            expect(gaps.countOpen).not.toHaveBeenCalled()
        })
    })

    describe("requestMining", () => {
        it("asks for the study of one agent's corrections as a manager and answers the command", async () => {
            const { page, members, commands } = await build()
            commands.request.mockResolvedValue("cmd-1")

            await expect(page.requestMining(USER, WORKSPACE, "sales")).resolves.toBe("cmd-1")

            expect(members.require).toHaveBeenCalledWith(USER, WORKSPACE, ["owner", "manager"])
            expect(commands.request).toHaveBeenCalledWith(USER, WORKSPACE, "lessons.mine", { module: "sales" })
        })
    })

    describe("miningState", () => {
        it("reads the counts and the reason out of the stored result", async () => {
            const { page, commands } = await build()
            commands.stateOf.mockResolvedValue({
                status: "done",
                result: { corrections: 4, newCases: 2, proposed: 0, reason: "no_pattern" },
                errorCode: null,
            })

            await expect(page.miningState(USER, WORKSPACE, "cmd-1")).resolves.toEqual({
                id: "cmd-1",
                status: "done",
                corrections: 4,
                newCases: 2,
                proposed: 0,
                reason: "no_pattern",
                errorCode: null,
            })
        })

        it("answers empty counts while the study runs or after it failed", async () => {
            const { page, commands } = await build()
            commands.stateOf.mockResolvedValue({ status: "failed", result: null, errorCode: "BRAIN_MODEL_UNAVAILABLE" })

            await expect(page.miningState(USER, WORKSPACE, "cmd-1")).resolves.toEqual({
                id: "cmd-1",
                status: "failed",
                corrections: null,
                newCases: null,
                proposed: null,
                reason: null,
                errorCode: "BRAIN_MODEL_UNAVAILABLE",
            })
        })

        it("refuses a command the person did not ask for", async () => {
            const { page, commands } = await build()
            commands.stateOf.mockResolvedValue(null)

            await expect(page.miningState(USER, WORKSPACE, "cmd-9")).rejects.toMatchObject({
                code: BrainErrorCode.CommandNotFound,
            })
        })
    })
})
