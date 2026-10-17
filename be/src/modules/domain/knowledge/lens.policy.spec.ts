import { Test } from "@nestjs/testing"
import { builder } from "@starci/jest-preset"
import type { Lens, LensRequest } from "./knowledge.contracts"
import { isInLens, lensOf } from "./lens.policy"

const SUBJECT = Symbol("lens.policy")
type Subject = {
    lensOf: typeof lensOf
    isInLens: typeof isInLens
}

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { lensOf, isInLens } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const requestOf = builder<LensRequest>({ workspaceId: "ws-1", module: "sales", moduleAudience: "internal" })
const lensBuilder = builder<Lens>({ workspaceId: "ws-1", module: "sales", audience: "internal", installationId: null })

describe("lensOf", () => {
    it("gives an internal module the internal view", async () => {
        const subject = await build()

        expect(subject.lensOf(requestOf())).toEqual(lensBuilder())
    })

    it.each([
        ["a customer-facing module", requestOf({ moduleAudience: "customer" })],
        ["a marketing module", requestOf({ module: "content" })],
        ["a caller that asks to be narrowed", requestOf({ requestedAudience: "customer" })],
    ])("gives %s the public view", async (_name, request) => {
        const subject = await build()

        expect(subject.lensOf(request).audience).toBe("customer")
    })

    it("never widens: an internal request does not lift a customer-facing module", async () => {
        const subject = await build()

        expect(subject.lensOf(requestOf({ moduleAudience: "customer", requestedAudience: "internal" })).audience).toBe(
            "customer",
        )
    })

    it("scopes the lens to an agent instance when one is named", async () => {
        const subject = await build()

        expect(subject.lensOf(requestOf({ installationId: "inst-1" })).installationId).toBe("inst-1")
    })
})

describe("isInLens", () => {
    const lens = lensBuilder({ installationId: "inst-1" })

    it("reads what is for every module and instance, and what is for its own", async () => {
        const subject = await build()

        expect(subject.isInLens(lens, { module: null, installationId: null })).toBe(true)
        expect(subject.isInLens(lens, { module: "sales", installationId: "inst-1" })).toBe(true)
    })

    it("does not read another module or another instance", async () => {
        const subject = await build()

        expect(subject.isInLens(lens, { module: "chatbot", installationId: null })).toBe(false)
        expect(subject.isInLens(lens, { module: null, installationId: "inst-2" })).toBe(false)
    })
})
