import { Test } from "@nestjs/testing"
import { InboxSimulationErrorCode } from "./errors/inbox-simulation.error"
import type { InboxSimulationInput } from "./inbox-simulation.contracts"
import {
    toSimulatedInput as realToSimulatedInput,
    simulationStatusOf as realSimulationStatusOf,
} from "./inbox-simulation.policy"

const SUBJECT = Symbol("inbox-simulation.policy")

type Subject = Pick<typeof import("./inbox-simulation.policy"), "toSimulatedInput" | "simulationStatusOf">

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: { toSimulatedInput: realToSimulatedInput, simulationStatusOf: realSimulationStatusOf },
            },
        ],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const INPUT: InboxSimulationInput = {
    channel: "email",
    kind: "message",
    senderName: " Binh ",
    eventId: " event-1 ",
    locale: "vi",
}

describe("toSimulatedInput", () => {
    it("trims the supplied event fields and rounds the amount to whole VND", async () => {
        const subject = await build()

        expect(
            subject.toSimulatedInput("ws-1", {
                ...INPUT,
                senderContact: " contact@example.com ",
                body: " Need two boxes ",
                amountVnd: 1000.6,
                externalRef: " order-1 ",
            }),
        ).toEqual({
            workspaceId: "ws-1",
            channel: "email",
            kind: "message",
            origin: "simulated",
            senderName: "Binh",
            senderContact: "contact@example.com",
            body: "Need two boxes",
            amountVnd: 1001,
            externalRef: "order-1",
            eventId: "event-1",
        })
    })
    it("defaults absent optional fields to the stored empty or null representation", async () => {
        const subject = await build()

        expect(subject.toSimulatedInput("ws-1", INPUT)).toEqual({
            workspaceId: "ws-1",
            channel: "email",
            kind: "message",
            origin: "simulated",
            senderName: "Binh",
            senderContact: null,
            body: "",
            amountVnd: null,
            externalRef: null,
            eventId: "event-1",
        })
    })
})

describe("toSimulatedInput", () => {
    it("collapses whitespace contacts and references while preserving an explicit zero amount", async () => {
        const subject = await build()

        expect(
            subject.toSimulatedInput("ws-1", {
                ...INPUT,
                senderContact: " ",
                externalRef: " ",
                body: null,
                amountVnd: 0,
            }),
        ).toEqual({
            workspaceId: "ws-1",
            channel: "email",
            kind: "message",
            origin: "simulated",
            senderName: "Binh",
            senderContact: null,
            body: "",
            amountVnd: 0,
            externalRef: null,
            eventId: "event-1",
        })
    })
    it.each([
        { senderName: " A " },
        { eventId: " " },
        { eventId: undefined },
        { eventId: null },
        { amountVnd: Number.NaN },
        { amountVnd: Number.POSITIVE_INFINITY },
        { amountVnd: -1 },
        { amountVnd: Number.MAX_SAFE_INTEGER + 1 },
    ])("rejects invalid input %p", async (override) => {
        const subject = await build()

        expect(() => subject.toSimulatedInput("ws-1", { ...INPUT, ...override })).toThrow(
            expect.objectContaining({ code: InboxSimulationErrorCode.Invalid }),
        )
    })
})

describe("toSimulatedInput", () => {
    it("accepts the maximum safe amount and trims a two-character sender", async () => {
        const subject = await build()

        expect(
            subject.toSimulatedInput("ws-1", { ...INPUT, senderName: " An ", amountVnd: Number.MAX_SAFE_INTEGER }),
        ).toEqual({
            workspaceId: "ws-1",
            channel: "email",
            kind: "message",
            origin: "simulated",
            senderName: "An",
            senderContact: null,
            body: "",
            amountVnd: Number.MAX_SAFE_INTEGER,
            externalRef: null,
            eventId: "event-1",
        })
    })
})

describe("simulationStatusOf", () => {
    it.each([
        { state: "failed", work: "done", queued: 1, failed: 0, event: "processed" },
        { state: "done", work: "failed", queued: 1, failed: 0, event: "processed" },
        { state: "done", work: "done", queued: 1, failed: 1, event: "processed" },
        { state: "done", work: "done", queued: 1, failed: 0, event: "failed" },
    ])("prioritizes any failed authority over queued work: %p", async ({ state, work, queued, failed, event }) => {
        const subject = await build()

        expect(subject.simulationStatusOf(state, work, queued, failed, event)).toBe("failed")
    })
    it.each([
        ["running", 1, "running"],
        ["done", 1, "queued"],
        ["done", 0, "succeeded"],
        ["running", 0, "running"],
        ["queued", 0, "queued"],
        [undefined, 0, "queued"],
    ])("maps job state %p with %p queued steps to %p", async (state, queued, expected) => {
        const subject = await build()

        expect(subject.simulationStatusOf(state, null, queued)).toBe(expected)
    })
    it("defaults absent work counts and event state to queued", async () => {
        const subject = await build()

        expect(subject.simulationStatusOf(undefined)).toBe("queued")
    })
})
