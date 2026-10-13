import { builder } from "@starci/jest-preset"
import type { Lens, LensRequest } from "./knowledge.contracts"
import { isInLens, lensOf } from "./lens.policy"

const requestOf = builder<LensRequest>({ workspaceId: "ws-1", module: "sales", moduleAudience: "internal" })
const lensBuilder = builder<Lens>({ workspaceId: "ws-1", module: "sales", audience: "internal", installationId: null })

describe("lensOf", () => {
    it("gives an internal module the internal view", () => {
        expect(lensOf(requestOf())).toEqual(lensBuilder())
    })

    it.each([
        ["a customer-facing module", requestOf({ moduleAudience: "customer" })],
        ["a marketing module", requestOf({ module: "content" })],
        ["a caller that asks to be narrowed", requestOf({ requestedAudience: "customer" })],
    ])("gives %s the public view", (_name, request) => {
        expect(lensOf(request).audience).toBe("customer")
    })

    it("never widens: an internal request does not lift a customer-facing module", () => {
        expect(lensOf(requestOf({ moduleAudience: "customer", requestedAudience: "internal" })).audience).toBe(
            "customer",
        )
    })

    it("scopes the lens to an agent instance when one is named", () => {
        expect(lensOf(requestOf({ installationId: "inst-1" })).installationId).toBe("inst-1")
    })
})

describe("isInLens", () => {
    const lens = lensBuilder({ installationId: "inst-1" })

    it("reads what is for every module and instance, and what is for its own", () => {
        expect(isInLens(lens, { module: null, installationId: null })).toBe(true)
        expect(isInLens(lens, { module: "sales", installationId: "inst-1" })).toBe(true)
    })

    it("does not read another module or another instance", () => {
        expect(isInLens(lens, { module: "chatbot", installationId: null })).toBe(false)
        expect(isInLens(lens, { module: null, installationId: "inst-2" })).toBe(false)
    })
})
