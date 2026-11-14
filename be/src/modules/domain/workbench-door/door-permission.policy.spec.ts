import { Test } from "@nestjs/testing"
import { mayRunAction as realMayRunAction } from "./door-permission.policy"

const SUBJECT = Symbol("door-permission.policy")

interface Subject {
    readonly mayRunAction: typeof realMayRunAction
}

const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { mayRunAction: realMayRunAction } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("mayRunAction", () => {
    let mayRunAction: Subject["mayRunAction"]

    beforeAll(async () => {
        ;({ mayRunAction } = await build())
    })

    it.each(["owner", "manager"] as const)("lets a %s run every action, marked for staff or not", (role) => {
        expect(mayRunAction(role, false)).toBe(true)
        expect(mayRunAction(role, true)).toBe(true)
    })

    it("lets a staff member run an action only when the action declares the staff mark", () => {
        expect(mayRunAction("staff", true)).toBe(true)
        expect(mayRunAction("staff", false)).toBe(false)
    })
})
