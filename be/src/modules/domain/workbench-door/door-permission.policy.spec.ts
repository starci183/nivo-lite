import { Test } from "@nestjs/testing"
import type { MemberGrant } from "@modules/domain/member-grants"
import { holdsPermission as realHoldsPermission } from "./door-permission.policy"

const SUBJECT = Symbol("door-permission.policy")

interface Subject {
    readonly holdsPermission: typeof realHoldsPermission
}

const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { holdsPermission: realHoldsPermission } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const grantOf = (memberId: string): MemberGrant => ({
    id: `grant-${memberId}`,
    workspace_id: "ws-1",
    member_id: memberId,
    action: "sales.manage",
    unit: "count",
    max_amount: null,
    updated_at: "2026-11-05T00:00:00.000Z",
})

describe("holdsPermission", () => {
    let holdsPermission: Subject["holdsPermission"]

    beforeAll(async () => {
        ;({ holdsPermission } = await build())
    })

    it.each(["owner", "manager"] as const)("gives a %s every permission without a grant", (role) => {
        expect(holdsPermission(role, "member-1", [])).toBe(true)
    })

    it("gives a staff member a permission granted to their seat", () => {
        expect(holdsPermission("staff", "member-1", [grantOf("member-2"), grantOf("member-1")])).toBe(true)
    })

    it("refuses a staff member a permission granted only to other seats", () => {
        expect(holdsPermission("staff", "member-1", [grantOf("member-2")])).toBe(false)
    })

    it("refuses a staff member a permission nobody granted", () => {
        expect(holdsPermission("staff", "member-1", [])).toBe(false)
    })
})
