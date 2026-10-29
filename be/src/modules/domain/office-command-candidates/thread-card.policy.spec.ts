import { Test } from "@nestjs/testing"
import {
    cardRefOf as realCardRefOf,
    executionStateOf as realExecutionStateOf,
    isRecordId as realIsRecordId,
    workItemStateOf as realWorkItemStateOf,
} from "./thread-card.policy"

const SUBJECT = Symbol("thread-card.policy")

const functions = {
    cardRefOf: realCardRefOf,
    executionStateOf: realExecutionStateOf,
    isRecordId: realIsRecordId,
    workItemStateOf: realWorkItemStateOf,
}

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    cardRefOf: realCardRefOf,
                    executionStateOf: realExecutionStateOf,
                    isRecordId: realIsRecordId,
                    workItemStateOf: realWorkItemStateOf,
                },
            },
        ],
    }).compile()
    return moduleRef.get<typeof functions>(SUBJECT)
}

describe("cardRefOf", () => {
    it("names the record a card points at", async () => {
        const { cardRefOf } = await buildSubject()
        expect(cardRefOf(JSON.stringify({ ref: { kind: "execution", id: "x-1" } }))).toEqual({
            kind: "execution",
            id: "x-1",
        })
    })

    it.each([
        ["a line without a card", null],
        ["a card that is not JSON", "{broken"],
        ["a card without a ref", JSON.stringify({ title: "t" })],
        ["a card that is not an object", JSON.stringify("text")],
        ["a ref that is not an object", JSON.stringify({ ref: "x" })],
        ["a ref without a kind", JSON.stringify({ ref: { id: "x-1" } })],
        ["a ref without an id", JSON.stringify({ ref: { kind: "execution" } })],
        ["a ref whose id is not text", JSON.stringify({ ref: { kind: "execution", id: 7 } })],
    ])("names nothing for %s", async (_name, card) => {
        const { cardRefOf } = await buildSubject()
        expect(cardRefOf(card)).toBeNull()
    })
})

describe("isRecordId", () => {
    it("accepts the lowercase text of a uuid only", async () => {
        const { isRecordId } = await buildSubject()
        expect(isRecordId("0b6f0c5e-2d41-4f55-9c9a-7a1c2f3e4d5b")).toBe(true)
        expect(isRecordId("0B6F0C5E-2D41-4F55-9C9A-7A1C2F3E4D5B")).toBe(false)
        expect(isRecordId("x-1")).toBe(false)
    })
})

describe("card states", () => {
    it.each([
        ["pending_approval", "pending"],
        ["approved", "approved"],
        ["rejected", "declined"],
    ])("reads the execution status %s as %s", async (status, state) => {
        const { executionStateOf } = await buildSubject()
        expect(executionStateOf(status)).toBe(state)
    })

    it.each([
        ["waiting_decision", "pending"],
        ["done", "done"],
        ["rejected", "declined"],
        ["failed", "failed"],
        ["running", "queued"],
    ])("reads the work item status %s as %s", async (status, state) => {
        const { workItemStateOf } = await buildSubject()
        expect(workItemStateOf(status)).toBe(state)
    })
})
