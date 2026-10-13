import { mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { AgentsService } from "@modules/domain/agents"
import { BrainCommandsService } from "@modules/domain/brain-commands"
import { BrainExtractionsService } from "@modules/domain/brain-extractions"
import { BrainFactsService } from "@modules/domain/brain-facts"
import { BrainLessonsService } from "@modules/domain/brain-lessons"
import { KnowledgeGapsService } from "@modules/domain/knowledge-gaps"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { BrainPageService } from "./brain-page.service"

const member: WorkspaceMember = {
    userId: "user-1",
    workspaceId: "ws-1",
    role: "staff",
    staffId: null,
    displayName: "An",
    status: "active",
}

describe("BrainPageService", () => {
    const build = async () => {
        const members = mock<WorkspaceMembersService>()
        members.require.mockResolvedValue(member)
        const lessons = mock<BrainLessonsService>()
        lessons.list.mockResolvedValue([])
        const agents = mock<AgentsService>()
        agents.list.mockResolvedValue([])
        const moduleRef = await Test.createTestingModule({
            providers: [
                BrainPageService,
                { provide: WorkspaceMembersService, useValue: members },
                { provide: BrainFactsService, useValue: mock<BrainFactsService>() },
                { provide: BrainLessonsService, useValue: lessons },
                { provide: KnowledgeGapsService, useValue: mock<KnowledgeGapsService>() },
                { provide: BrainExtractionsService, useValue: mock<BrainExtractionsService>() },
                { provide: BrainCommandsService, useValue: mock<BrainCommandsService>() },
                { provide: AgentsService, useValue: agents },
            ],
        }).compile()
        return moduleRef.get(BrainPageService)
    }

    it("shows a staff member the lessons only", async () => {
        const service = await build()

        await expect(service.overview("user-1", "ws-1")).resolves.toEqual({
            facts: [],
            lessons: [],
            gaps: [],
            gapsOpen: 0,
            extractions: [],
            lenses: [],
        })
    })
})
