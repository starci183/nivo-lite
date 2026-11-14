import { mock } from "@starci/jest-preset"
import type { ContactWorkRow, ContactWorkStore } from "./contact-work-store.port"
import { CONTACT_WORK_MAX, ContactWorkService } from "./contact-work.service"
import type { ContactsService } from "./contacts.service"

const WS = "11111111-1111-4111-8111-111111111111"

const rowOf = (nodeKey: string, over: Partial<ContactWorkRow> = {}): ContactWorkRow => ({
    id: `e-${nodeKey}`,
    namespace: "sales.consult",
    nodeKey,
    step: "chatbot.answer",
    status: "done",
    at: "2026-11-14T10:00:00.000Z",
    agentId: "agent-1",
    workflowId: "wf-1",
    runId: "run-1",
    ...over,
})

const build = (active: string | null = "contact-1") => {
    const store = mock<ContactWorkStore>()
    const contacts = mock<ContactsService>()
    contacts.activeId.mockResolvedValue(active)
    store.recentOf.mockResolvedValue([])
    return { store, contacts, service: new ContactWorkService(store, contacts) }
}

describe("ContactWorkService.recent", () => {
    it("reads the step outcomes under the contact's subject key, following a merge to the survivor", async () => {
        const { store, contacts, service } = build("survivor-1")

        await service.recent(WS, "merged-away", 10)

        expect(contacts.activeId).toHaveBeenCalledWith(WS, "merged-away")
        expect(store.recentOf).toHaveBeenCalledWith(WS, "contact:survivor-1", 10)
    })

    it("answers nothing, and reads nothing, for a deleted or unknown contact (soft delete, R31)", async () => {
        const { store, service } = build(null)

        await expect(service.recent(WS, "contact-1")).resolves.toEqual([])
        expect(store.recentOf).not.toHaveBeenCalled()
    })

    it("splits a loop step's key into its node and its round, and leaves a step outside a loop with no round", async () => {
        const { store, service } = build()
        store.recentOf.mockResolvedValue([rowOf("talk[r2].opening"), rowOf("consult"), rowOf("each[item-9].pack")])

        const steps = await service.recent(WS, "contact-1")

        expect(steps.map((step) => [step.nodeKey, step.node, step.round])).toEqual([
            ["talk[r2].opening", "opening", 2],
            ["consult", "consult", null],
            ["each[item-9].pack", "pack", null],
        ])
        expect(steps[0]).toMatchObject({ workflowId: "wf-1", agentId: "agent-1", step: "chatbot.answer", status: "done" })
    })

    it("bounds the page: never over the maximum, never under one, 50 by default", async () => {
        const { store, service } = build()

        await service.recent(WS, "contact-1", 500)
        await service.recent(WS, "contact-1", 0)
        await service.recent(WS, "contact-1")

        expect(store.recentOf.mock.calls.map((call) => call[2])).toEqual([CONTACT_WORK_MAX, 1, CONTACT_WORK_MAX])
    })
})
