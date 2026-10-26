import { Test } from "@nestjs/testing"
import { CUSTOMER_MODULE, laneOpenTo, lanesOfView } from "./knowledge-lanes.policy"

const SUBJECT = Symbol("knowledge-view.lanes")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { laneOpenTo, lanesOfView } }],
    }).compile()
    return moduleRef.get<{ laneOpenTo: typeof laneOpenTo; lanesOfView: typeof lanesOfView }>(SUBJECT)
}

const PUBLIC_ONLY = {
    documentPublic: true,
    documentInternal: false,
    factPublic: true,
    factInternal: false,
    factRestricted: false,
}

describe("knowledge view lanes", () => {
    it("opens the public lanes to everyone and the internal lanes to the team's view only", async () => {
        const subject = await build()

        expect(subject.laneOpenTo("customer", "documentPublic")).toBe(true)
        expect(subject.laneOpenTo("customer", "factPublic")).toBe(true)
        expect(subject.laneOpenTo("customer", "documentInternal")).toBe(false)
        expect(subject.laneOpenTo("customer", "factInternal")).toBe(false)
        expect(subject.laneOpenTo("customer", "factRestricted")).toBe(false)
        expect(subject.laneOpenTo("internal", "factRestricted")).toBe(true)
    })

    it("reads the lanes through the same view the agent gets", async () => {
        const subject = await build()

        expect(subject.lanesOfView("chatbot")).toEqual(PUBLIC_ONLY)
        expect(subject.lanesOfView("content", "internal")).toEqual(PUBLIC_ONLY)
        expect(subject.lanesOfView("accounting", "customer")).toEqual(PUBLIC_ONLY)
        expect(subject.lanesOfView("accounting")).toEqual({
            documentPublic: true,
            documentInternal: true,
            factPublic: true,
            factInternal: true,
            factRestricted: true,
        })
    })

    it("asks the public's view as a customer-facing module", async () => {
        const subject = await build()

        expect(subject.lanesOfView(CUSTOMER_MODULE, "customer")).toEqual(PUBLIC_ONLY)
        expect(subject.lanesOfView(CUSTOMER_MODULE)).toEqual(PUBLIC_ONLY)
    })
})
