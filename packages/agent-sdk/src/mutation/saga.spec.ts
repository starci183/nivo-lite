import { z } from "../schema/zod-entry"
import { defineJob } from "./job"
import { defineSaga, SAGA_STEPS_MAX, sagaDefinitionProblems, sagaProblems } from "./saga"
import type { SagaConfig, SagaStep } from "./saga"
import { SagaDefinitionError } from "./saga-definition-error"
import { entities } from "./mutation.fixture"

const job = (name: string, shape: z.ZodRawShape = { runId: z.uuid() }) =>
    defineJob({ name, input: z.object(shape), ports: {}, attempts: 3, run: () => Promise.resolve() })

const reserve = job("demo.reserve")
const unreserve = job("demo.unreserve")
const charge = job("demo.charge", { runId: z.uuid(), orderId: z.uuid() })
const refund = job("demo.refund")
const foreign = job("demo.foreign", { other: z.uuid() })

const one: SagaConfig["steps"] = [{ job: reserve, compensate: unreserve }]

const config = (steps: SagaConfig["steps"], state = "demo.run", name = "demo.checkout"): SagaConfig => ({
    name,
    steps,
    state,
})

describe("sagaDefinitionProblems", () => {
    it("accepts steps each paired with a compensation that takes ids its step carries", () => {
        expect(
            sagaDefinitionProblems(
                config([
                    { job: reserve, compensate: unreserve },
                    { job: charge, compensate: refund },
                ]),
            ),
        ).toEqual([])
    })

    it("refuses a malformed saga name", () => {
        expect(
            sagaDefinitionProblems(config([{ job: reserve, compensate: unreserve }], "demo.run", "checkout")),
        ).toEqual([{ code: "SAGA_NAME_MALFORMED", at: "checkout" }])
    })

    it("refuses more than the maximum of steps", () => {
        const extra: Array<SagaStep> = Array.from({ length: SAGA_STEPS_MAX }, (_, i) => ({
            job: job(`demo.step-${i}`),
            compensate: job(`demo.undo-${i}`),
        }))
        expect(sagaDefinitionProblems(config([...one, ...extra]))).toEqual([
            { code: "SAGA_STEPS_TOO_MANY", at: "demo.checkout" },
        ])
    })

    it("refuses the same job twice, a self compensation and a compensation taking an id its step lacks", () => {
        expect(
            sagaDefinitionProblems(
                config([
                    { job: reserve, compensate: unreserve },
                    { job: reserve, compensate: unreserve },
                ]),
            ),
        ).toEqual([{ code: "SAGA_STEP_DUPLICATE", at: "demo.checkout.demo.reserve" }])
        expect(sagaDefinitionProblems(config([{ job: reserve, compensate: reserve }]))).toEqual([
            { code: "SAGA_COMPENSATION_SELF", at: "demo.checkout.demo.reserve" },
        ])
        expect(sagaDefinitionProblems(config([{ job: reserve, compensate: foreign }]))).toEqual([
            { code: "SAGA_COMPENSATION_INPUT_MISMATCH", at: "demo.checkout.demo.reserve" },
        ])
    })
})

describe("sagaProblems", () => {
    it("accepts a state entity with a status enum", () => {
        expect(sagaProblems(config(one), entities)).toEqual([])
    })

    it("refuses an unknown state entity", () => {
        expect(sagaProblems(config(one, "demo.none"), entities)).toEqual([
            { code: "SAGA_STATE_UNKNOWN", at: "demo.none" },
        ])
    })

    it("refuses a state without a status enum", () => {
        expect(sagaProblems(config(one, "demo.bare"), entities)).toEqual([
            { code: "SAGA_STATE_STATUS_MISSING", at: "demo.bare" },
        ])
        expect(sagaProblems(config(one, "demo.textstatus"), entities)).toEqual([
            { code: "SAGA_STATE_STATUS_MISSING", at: "demo.textstatus" },
        ])
    })

    it("reports the saga's own problems first", () => {
        expect(sagaProblems(config(one, "demo.run", "checkout"), entities)).toEqual([
            { code: "SAGA_NAME_MALFORMED", at: "checkout" },
        ])
    })
})

describe("defineSaga", () => {
    it("returns the declaration with its entry", () => {
        const saga = defineSaga(config(one))
        expect(saga.entry).toBe("saga")
        expect(saga.steps).toHaveLength(1)
    })

    it("throws the first problem at definition", () => {
        const attempt = (): unknown => defineSaga(config([{ job: reserve, compensate: reserve }]))
        expect(attempt).toThrow(SagaDefinitionError)
        expect(attempt).toThrow("SAGA_COMPENSATION_SELF: demo.checkout.demo.reserve")
    })
})
