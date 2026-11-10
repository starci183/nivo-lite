import { Test } from "@nestjs/testing"
import { FOUNDER, MANAGERS, rolesToDecide as realRolesToDecide } from "./founder.policy"


const SUBJECT = Symbol("founder.policy")



describe("founder.policy as a Nest value", () => {
    let rolesToDecide: typeof realRolesToDecide

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({
            providers: [{ provide: SUBJECT, useValue: { rolesToDecide: realRolesToDecide } }],
        }).compile()
        const subject = moduleRef.get<{ rolesToDecide: typeof realRolesToDecide }>(SUBJECT)
        rolesToDecide = subject.rolesToDecide
    })

    describe("founder.policy", () => {
        it("lets the founder alone put a truth in force or take it out of force", () => {
            expect(FOUNDER).toEqual(["owner"])
            for (const action of ["apply", "choose", "split", "retire"] as const) expect(rolesToDecide(action)).toBe(FOUNDER)
        })

        it("lets a manager turn a proposal down: nothing in force changes", () => {
            expect(rolesToDecide("reject")).toBe(MANAGERS)
            expect(MANAGERS).toEqual(["owner", "manager"])
        })
    })
})
