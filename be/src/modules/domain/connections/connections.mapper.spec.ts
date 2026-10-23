import { Test } from "@nestjs/testing"
import { toConnectionRecord as realToConnectionRecord } from "./connections.mapper"
import { ConnectionsErrorCode } from "./errors/connections.error"
import type { ConnectionSelectRow } from "./persistence/connections.rows"

const objectLike = (shape: Record<string, unknown>): unknown => expect.objectContaining(shape)

/** What `run` throws, read as `unknown`; the matcher then judges its fields. */
const thrownBy = (run: () => unknown): unknown => {
    try {
        run()
    } catch (error) {
        return error
    }
    return undefined
}

const SUBJECT = Symbol("connections.mapper")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { toConnectionRecord: realToConnectionRecord } }],
    }).compile()
    const subject = moduleRef.get<{ toConnectionRecord: typeof realToConnectionRecord }>(SUBJECT)
    return { subject }
}

const row: ConnectionSelectRow = {
    id: "c1",
    workspace_id: "w1",
    provider: "sepay",
    name: "Bank",
    public_meta: { bank_code: "VCB" },
    status: "connected",
    last_error: null,
    environment: "test",
    is_default: true,
    last_event_at: "2026-10-12T01:00:00Z",
    first_event: { amount: 5, content: "hi", at: "2026-10-12T01:00:00Z" },
    created_by: "u1",
    created_at: "2026-10-01T00:00:00Z",
}

describe("toConnectionRecord", () => {
    it("maps every column to its camelCase field", async () => {
        const { subject } = await buildSubject()

        expect(subject.toConnectionRecord(row)).toEqual({
            id: "c1",
            workspaceId: "w1",
            provider: "sepay",
            name: "Bank",
            meta: { bank_code: "VCB" },
            status: "connected",
            lastError: null,
            environment: "test",
            isDefault: true,
            lastEventAt: "2026-10-12T01:00:00Z",
            firstEvent: { amount: 5, content: "hi", at: "2026-10-12T01:00:00Z" },
            createdBy: "u1",
            createdAt: "2026-10-01T00:00:00Z",
        })
    })

    it("falls back to empty meta, live and not default for odd stored values", async () => {
        const { subject } = await buildSubject()

        const odd: ConnectionSelectRow = { ...row, public_meta: [], environment: null, is_default: null }

        expect(subject.toConnectionRecord(odd)).toMatchObject({ meta: {}, environment: "live", isDefault: false })
        expect(subject.toConnectionRecord({ ...odd, public_meta: null })).toMatchObject({ meta: {} })
    })

    it.each([
        { provider: "unknown", status: "connected" },
        { provider: "sepay", status: "unknown" },
    ])("refuses stored provider $provider and status $status that cannot be mapped", async ({ provider, status }) => {
        const { subject } = await buildSubject()

        expect(thrownBy(() => subject.toConnectionRecord({ ...row, provider, status }))).toEqual(
            objectLike({ code: ConnectionsErrorCode.NotFound, params: { id: "c1" } }),
        )
    })
})

describe("toConnectionRecord public facts", () => {
    it("keeps only string public facts and includes a readable first-event text", async () => {
        const { subject } = await buildSubject()

        const firstEvent = { amount: 0, content: "", at: "2026-10-12T01:00:00Z", text: "Hello" }
        const mapped = subject.toConnectionRecord({
            ...row,
            public_meta: { bank_code: "VCB", count: 3, enabled: true, absent: null },
            first_event: firstEvent,
        })

        expect(mapped.meta).toEqual({ bank_code: "VCB" })
        expect(mapped.firstEvent).toEqual(firstEvent)
    })

    it("reads a finite numeric owner chat id as text while dropping other numeric facts", async () => {
        const { subject } = await buildSubject()

        const mapped = subject.toConnectionRecord({
            ...row,
            public_meta: { owner_chat_id: 123456789, count: 3, bad: Number.NaN },
        })

        expect(mapped.meta).toEqual({ owner_chat_id: "123456789" })
    })

    it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
        "drops a non-finite numeric owner chat id: %p",
        async (ownerChatId) => {
            const { subject } = await buildSubject()

            expect(subject.toConnectionRecord({ ...row, public_meta: { owner_chat_id: ownerChatId } }).meta).toEqual({})
        },
    )

    it("keeps an owner chat id that is already text", async () => {
        const { subject } = await buildSubject()

        expect(subject.toConnectionRecord({ ...row, public_meta: { owner_chat_id: "123456789" } }).meta).toEqual({
            owner_chat_id: "123456789",
        })
    })
})

describe("toConnectionRecord", () => {
    it.each([
        undefined,
        null,
        [],
        5,
        { amount: "5", content: "hi", at: "now" },
        { amount: 5, content: false, at: "now" },
        { amount: 5, content: "hi", at: 5 },
    ])("omits an invalid stored first event: %p", async (firstEvent) => {
        const { subject } = await buildSubject()

        expect(subject.toConnectionRecord({ ...row, first_event: firstEvent }).firstEvent).toBeNull()
    })

    it("omits non-string optional event text", async () => {
        const { subject } = await buildSubject()

        expect(
            subject.toConnectionRecord({
                ...row,
                first_event: { amount: 5, content: "hi", at: "now", text: 9 },
            }).firstEvent,
        ).toEqual({ amount: 5, content: "hi", at: "now" })
    })
})
