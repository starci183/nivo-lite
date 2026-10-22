import { Test } from "@nestjs/testing"
import { builder } from "@starci/jest-preset"
import { grantCoverageOf } from "./grant-coverage.policy"
import type { DirectoryMember, MemberGrant } from "./member-grants.contracts"

const SUBJECT = Symbol("grant-coverage.policy")

const memberOf = builder<DirectoryMember>({
    memberId: "member-1",
    name: "Anh Minh",
    role: "manager",
    roomId: "sales",
    status: "active",
    rooms: ["sales"],
})

const grantOf = builder<MemberGrant>({
    id: "grant-1",
    workspace_id: "ws-1",
    member_id: "member-1",
    action: "give_discount",
    unit: "percent",
    max_amount: 15,
    updated_at: "2026-10-22T09:00:00.000Z",
})

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { grantCoverageOf } }],
    }).compile()
    return moduleRef.get<{ grantCoverageOf: typeof grantCoverageOf }>(SUBJECT)
}

describe("grant coverage policy", () => {
    it("covers an amount at or under the limit of the member's grant", async () => {
        const subject = await buildSubject()

        expect(subject.grantCoverageOf(memberOf(), [grantOf()], { unit: "percent", amount: 15 })).toEqual({
            covered: true,
        })
        expect(subject.grantCoverageOf(memberOf(), [grantOf()], { unit: "percent", amount: 3 })).toEqual({
            covered: true,
        })
    })

    it("excludes an amount over the limit of the grant", async () => {
        const subject = await buildSubject()

        expect(
            subject.grantCoverageOf(memberOf(), [grantOf({ max_amount: 10 })], { unit: "percent", amount: 12 }),
        ).toEqual({
            covered: false,
            reason: "over_limit",
        })
    })

    it("covers any amount for a grant with no limit, and a request with no amount for any grant", async () => {
        const subject = await buildSubject()

        expect(
            subject.grantCoverageOf(memberOf(), [grantOf({ max_amount: null })], { unit: "percent", amount: 5000 }),
        ).toEqual({ covered: true })
        expect(
            subject.grantCoverageOf(memberOf(), [grantOf({ max_amount: 1 })], { unit: "percent", amount: null }),
        ).toEqual({
            covered: true,
        })
    })

    it("excludes a member with no grant, with a grant of another member, or with a grant in another unit", async () => {
        const subject = await buildSubject()
        const need = { unit: "percent" as const, amount: 3 }

        expect(subject.grantCoverageOf(memberOf(), [], need)).toEqual({ covered: false, reason: "no_grant" })
        expect(subject.grantCoverageOf(memberOf(), [grantOf({ member_id: "member-2" })], need)).toEqual({
            covered: false,
            reason: "no_grant",
        })
        expect(subject.grantCoverageOf(memberOf(), [grantOf({ unit: "vnd" })], need)).toEqual({
            covered: false,
            reason: "no_grant",
        })
    })

    it("always covers the workspace owner, grant or not", async () => {
        const subject = await buildSubject()

        expect(subject.grantCoverageOf(memberOf({ role: "owner" }), [], { unit: "vnd", amount: 900_000_000 })).toEqual({
            covered: true,
        })
    })

    it("never covers a disabled member, not even the owner", async () => {
        const subject = await buildSubject()
        const need = { unit: "percent" as const, amount: 3 }

        expect(subject.grantCoverageOf(memberOf({ status: "disabled" }), [grantOf()], need)).toEqual({
            covered: false,
            reason: "inactive",
        })
        expect(subject.grantCoverageOf(memberOf({ status: "disabled", role: "owner" }), [], need)).toEqual({
            covered: false,
            reason: "inactive",
        })
    })
})
