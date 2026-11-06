import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { TeamChatRoomsService } from "@modules/domain/team-chat"
import type { HubNote } from "./gateway-turns.contracts"
import { HubNotesService, noteBodyOf, toolSourcesOf } from "./hub-notes.service"

const NOTE: HubNote = {
    workspaceId: "ws",
    room: "sales",
    type: "handoff_note",
    title: "Held",
    fields: [
        { label: "Guest", value: "Lan" },
        { label: "Time", value: "" },
    ],
    authorName: "AI Sales",
    sources: toolSourcesOf(["crm.slots.find", "crm.slot.hold", "crm.slot.hold"]),
}
const REFS = { leadId: "l1", workItemId: null }

const build = async () => {
    const chat = mock<TeamChatRoomsService>({
        postAsAgent: jest.fn().mockResolvedValue({ roomId: "r1", messageId: "m1", agentId: "agent-1" }),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [HubNotesService, { provide: TeamChatRoomsService, useValue: chat }],
    }).compile()
    return { service: moduleRef.get(HubNotesService), chat }
}

describe("HubNotesService.post", () => {
    it("says the note to the owner as the agent, in one line of the title and its fields", async () => {
        const { service, chat } = await build()

        await expect(service.post(NOTE, "agent-1", REFS)).resolves.toBeUndefined()

        expect(chat.postAsAgent).toHaveBeenCalledWith("ws", {
            agent: "agent-1",
            toUserId: null,
            body: "Held · Guest: Lan · Time: ",
            key: null,
        })
    })

    it("does nothing when the agent is not of the workspace", async () => {
        const { service, chat } = await build()
        chat.postAsAgent.mockResolvedValue(null)

        await expect(service.post(NOTE, "gone", REFS)).resolves.toBeUndefined()
    })
})

describe("HubNotesService.postOnce", () => {
    it("keys the line by the operation, so a retried delivery is the same line and another operation is another", async () => {
        const { service, chat } = await build()

        await service.postOnce(NOTE, "agent-1", REFS, "operation-1")
        await service.postOnce({ ...NOTE, workspaceId: "other" }, "agent-1", REFS, "operation-1")

        expect(chat.postAsAgent.mock.calls.map(([workspaceId, post]) => [workspaceId, post.key])).toEqual([
            ["ws", "hub.note:operation-1"],
            ["other", "hub.note:operation-1"],
        ])
    })
})

describe("the client id", () => {
    it("fits the 64 characters of the column, the same for the same operation and another for another", async () => {
        const { service, chat } = await build()
        const long = "o".repeat(120)

        await service.postOnce(NOTE, "agent-1", REFS, long)
        await service.postOnce(NOTE, "agent-1", REFS, long)
        await service.postOnce(NOTE, "agent-1", REFS, `${long}2`)

        const keys = chat.postAsAgent.mock.calls.map(([, post]) => post.key)
        expect(keys[0]).toHaveLength(64)
        expect(keys[1]).toBe(keys[0])
        expect(keys[2]).not.toBe(keys[0])
    })
})

describe("note helpers", () => {
    it("reads a bare note as its title, and lists each tool the turn called once, in order", () => {
        expect(noteBodyOf({ ...NOTE, fields: [] })).toBe("Held")
        expect(toolSourcesOf(["a", "b", "a"]).map((source) => source.ref)).toEqual(["a", "b"])
        expect(toolSourcesOf([])).toEqual([])
    })
})
