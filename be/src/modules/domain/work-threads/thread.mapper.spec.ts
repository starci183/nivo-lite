import { Test } from "@nestjs/testing"
import type { WorkThreadRecord } from "./work-threads.contracts"
import { toThread } from "./thread.mapper"

const SUBJECT = Symbol("thread.mapper")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { toThread } }],
    }).compile()
    return moduleRef.get<typeof import("./thread.mapper")>(SUBJECT)
}

const threadRow = (overrides: Partial<WorkThreadRecord> = {}): WorkThreadRecord => ({
    id: "thread-1",
    workspace_id: "ws-1",
    title: "Villa booking for Ms Thao",
    lead_id: "lead-1",
    order_id: null,
    status: "waiting",
    created_by: "van",
    created_at: "2026-10-22T09:41:00+07:00",
    updated_at: "2026-10-22T09:45:00+07:00",
    ...overrides,
})

describe("thread mapper", () => {
    it("reads a thread row with ISO instants", async () => {
        const subject = await buildSubject()

        expect(subject.toThread(threadRow())).toEqual({
            id: "thread-1",
            workspaceId: "ws-1",
            title: "Villa booking for Ms Thao",
            leadId: "lead-1",
            orderId: null,
            status: "waiting",
            createdBy: "van",
            createdAt: "2026-10-22T02:41:00.000Z",
            updatedAt: "2026-10-22T02:45:00.000Z",
        })
    })

    it("falls back to open for a status it does not know", async () => {
        const subject = await buildSubject()

        expect(subject.toThread(threadRow({ status: "mystery" })).status).toBe("open")
    })
})
