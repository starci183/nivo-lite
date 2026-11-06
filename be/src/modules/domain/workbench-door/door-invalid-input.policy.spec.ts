import { Test } from "@nestjs/testing"
import { invalidInputOf as realInvalidInputOf } from "./door-invalid-input.policy"

const SUBJECT = Symbol("door-invalid-input.policy")

interface Subject {
    readonly invalidInputOf: typeof realInvalidInputOf
}

const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { invalidInputOf: realInvalidInputOf } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const message = { key: "renderer.invalid" }

describe("door-invalid-input.policy invalidInputOf", () => {
    it("names the action and the keys of the refused fields, and nothing else", async () => {
        const { invalidInputOf } = await build()
        const result = { ok: false, reason: "invalid", message, fields: { order: message, values: message } } as const
        expect(invalidInputOf("accounting.resolve-unmatched-payment", result)).toEqual({
            action: "accounting.resolve-unmatched-payment",
            fields: ["order", "values"],
        })
    })

    it("names no field when the result names none", async () => {
        const { invalidInputOf } = await build()
        expect(invalidInputOf("sales.move-stage", { ok: false, reason: "invalid", message })).toEqual({
            action: "sales.move-stage",
            fields: [],
        })
    })

    it("says nothing for a result that is not an invalid input", async () => {
        const { invalidInputOf } = await build()
        expect(invalidInputOf("sales.move-stage", { ok: true })).toBeNull()
        expect(invalidInputOf("sales.move-stage", { ok: false, reason: "conflict", message })).toBeNull()
    })
})
