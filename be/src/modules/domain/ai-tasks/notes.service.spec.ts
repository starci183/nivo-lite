import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { AiTaskScope } from "./ai-tasks.contracts"
import { AI_TASKS_RECALL } from "./ai-tasks.decorators"
import type { AiTaskRecall } from "./ai-tasks.port"
import { NotesService } from "./notes.service"

const lane = { module: "sales", installationId: "i1", audience: "customer" as const }
const scope: AiTaskScope = { workspaceId: "ws-1", locale: "vi", lane }

const build = async () => {
    const recall = mock<AiTaskRecall>()
    const moduleRef = await Test.createTestingModule({
        providers: [NotesService, { provide: AI_TASKS_RECALL, useValue: recall }],
    }).compile()
    return { service: moduleRef.get(NotesService), recall }
}

describe("NotesService", () => {
    it("retrieves nothing for a scope without a lane or a task without a question", async () => {
        const { service, recall } = await build()

        expect(service.contextOf({ workspaceId: "ws-1", locale: "vi" }, "q")).toBeNull()
        expect(service.contextOf(scope, null)).toBeNull()
        expect(recall.notes).not.toHaveBeenCalled()
    })

    it("wraps the search of the agent lane: the lane, the workspace and the question go to the Second Brain, the passages come back", async () => {
        const { service, recall } = await build()
        recall.notes.mockResolvedValue([{ title: "Hours", content: "Open 8 to 21" }])

        const context = service.contextOf(scope, "hours?")

        expect(context).toMatchObject({ question: "hours?", limit: 4 })
        await expect(context?.search("hours?")).resolves.toEqual([{ title: "Hours", content: "Open 8 to 21" }])
        expect(recall.notes).toHaveBeenCalledWith({ workspaceId: "ws-1", ...lane, question: "hours?", limit: 4 })
    })

    it("finds no notes on an empty brain", async () => {
        const { service, recall } = await build()
        recall.notes.mockResolvedValue([])

        await expect(service.contextOf(scope, "q")?.search("q")).resolves.toEqual([])
    })

    it("does not widen the lane of a customer-facing draft: the audience it was given is the audience searched", async () => {
        const { service, recall } = await build()
        recall.notes.mockResolvedValue([])

        await service.contextOf(scope, "q")?.search("q")

        expect(recall.notes.mock.calls[0]?.[0]).toMatchObject({ audience: "customer", module: "sales" })
    })
})
