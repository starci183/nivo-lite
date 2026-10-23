import { Test } from "@nestjs/testing"
import { Secret } from "@modules/platform/config"
import { WorkspaceSeedErrorCode } from "./errors/workspace-seed.error"
import type { OfficeAgent, OfficeAuthoritySeed, OfficeProfile, OfficeRuleSeed } from "./office-seed.contracts"
import { officeIssuesOf, readOfficeInput } from "./office-seed.policy"
import { HAKUEN_OFFICE_AUTHORITY } from "./profiles/hakuen-office.authority.templates"
import { HAKUEN_OFFICE } from "./profiles/hakuen-office.templates"

/** A partial-object matcher, typed `unknown` so it flows into any slot. */
const objectLike = (shape: Record<string, unknown>): unknown => expect.objectContaining(shape)

/** A sub-array matcher, typed `unknown` so it flows into any slot. */
const arrayLike = (items: ReadonlyArray<unknown>): unknown => expect.arrayContaining(items)

/** What `run` throws, read as `unknown`; the matcher then judges its fields. */
const thrownBy = (run: () => unknown): unknown => {
    try {
        run()
    } catch (error) {
        return error
    }
    return undefined
}

type Subject = {
    officeIssuesOf: typeof officeIssuesOf
    readOfficeInput: typeof readOfficeInput
}

const SUBJECT = Symbol("office-seed.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { officeIssuesOf, readOfficeInput } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const WIRE = {
    schema: "nivo/workspace-office-input@1",
    people: {
        ha: { email: "Ha@Example.Test", name: " Chi Ha ", password: "ha-private" },
        van: { email: "van@example.test", name: "Van" },
    },
}
const inputOf = (value: unknown): Secret => new Secret(JSON.stringify(value))
const withHa = (account: unknown): Secret => inputOf({ ...WIRE, people: { ...WIRE.people, ha: account } })

describe("readOfficeInput", () => {
    it("reads the accounts of chi Ha and Van, lower-casing emails and trimming names", async () => {
        const subject = await buildSubject()

        expect(subject.readOfficeInput(inputOf(WIRE))).toEqual({
            ha: { email: "ha@example.test", name: "Chi Ha", password: "ha-private" },
            van: { email: "van@example.test", name: "Van" },
        })
    })

    it("requires the private input", async () => {
        const subject = await buildSubject()

        expect(thrownBy(() => subject.readOfficeInput(undefined))).toEqual(
            objectLike({ code: WorkspaceSeedErrorCode.InputRequired }),
        )
    })

    it.each([
        { name: "text that is not JSON", value: new Secret("not json") },
        { name: "another schema", value: inputOf({ ...WIRE, schema: "other@1" }) },
        { name: "a non-object", value: inputOf([]) },
        { name: "an unknown top-level key", value: inputOf({ ...WIRE, extra: 1 }) },
        { name: "people that are not an object", value: inputOf({ ...WIRE, people: [] }) },
        { name: "an unknown person", value: inputOf({ ...WIRE, people: { ...WIRE.people, lan: WIRE.people.ha } }) },
        { name: "a missing person", value: inputOf({ ...WIRE, people: { ha: WIRE.people.ha } }) },
        { name: "an unknown account key", value: withHa({ ...WIRE.people.ha, role: "owner" }) },
        { name: "an email without a domain dot", value: withHa({ email: "ha@example", name: "Ha" }) },
        { name: "a blank name", value: withHa({ email: "ha@example.test", name: "   " }) },
        { name: "a non-text password", value: withHa({ ...WIRE.people.ha, password: 7 }) },
    ])("refuses $name", async ({ value }) => {
        const subject = await buildSubject()

        expect(thrownBy(() => subject.readOfficeInput(value))).toEqual(
            objectLike({ code: WorkspaceSeedErrorCode.InputInvalid }),
        )
    })
})

const withAgent = (change: Partial<OfficeAgent>): OfficeProfile => ({
    ...HAKUEN_OFFICE,
    agents: { ...HAKUEN_OFFICE.agents, sales: { ...HAKUEN_OFFICE.agents.sales, ...change } },
})

const withRule = (change: Partial<OfficeRuleSeed>): OfficeAuthoritySeed => ({
    ...HAKUEN_OFFICE_AUTHORITY,
    rules: HAKUEN_OFFICE_AUTHORITY.rules.map((rule, index) => (index === 0 ? { ...rule, ...change } : rule)),
})

describe("the story of the video", () => {
    it("holds together: no issue is found in the profile and its authority data", async () => {
        const subject = await buildSubject()

        expect(subject.officeIssuesOf(HAKUEN_OFFICE, HAKUEN_OFFICE_AUTHORITY)).toEqual([])
    })

    it("has five people, four agents, and managers approving 15 and 10 percent", () => {
        expect(Object.keys(HAKUEN_OFFICE.people)).toEqual(["nam", "minh", "ha", "van", "lan"])
        expect(Object.values(HAKUEN_OFFICE.agents).map((agent) => agent.handle)).toEqual([
            "office-ai-sales",
            "office-ke-toan-ai",
            "office-ai-cskh",
            "office-ai-marketing",
        ])
        expect(HAKUEN_OFFICE_AUTHORITY.grants.filter((grant) => grant.action === "give_discount")).toEqual(
            arrayLike([
                { member: "minh", action: "give_discount", unit: "percent", limit: 15 },
                { member: "ha", action: "give_discount", unit: "percent", limit: 10 },
            ]),
        )
    })
})

describe("officeIssuesOf", () => {
    it("needs exactly one owner", async () => {
        const subject = await buildSubject()
        const people = { ...HAKUEN_OFFICE.people, minh: { ...HAKUEN_OFFICE.people.minh, role: "owner" as const } }

        expect(subject.officeIssuesOf({ ...HAKUEN_OFFICE, people }, HAKUEN_OFFICE_AUTHORITY)).toContain(
            "the office needs one owner",
        )
    })

    it("finds an unknown room anywhere a room is named", async () => {
        const subject = await buildSubject()
        const base = withAgent({ room: "garage", assignableRooms: ["garage"] })
        const profile = { ...base, people: { ...base.people, nam: { role: "owner" as const, room: "garage" } } }

        expect(
            subject.officeIssuesOf(
                profile,
                withRule({ approver_group: { roles: [], rooms: ["garage"], members: [] } }),
            ),
        ).toEqual(
            arrayLike([
                "nam sits in an unknown room",
                "sales lives in an unknown room",
                "sales is open to an unknown room",
                "give_discount asks an unknown room",
            ]),
        )
    })

    it("finds an agent that tags itself", async () => {
        const subject = await buildSubject()

        expect(subject.officeIssuesOf(withAgent({ canTag: ["sales"] }), HAKUEN_OFFICE_AUTHORITY)).toContain(
            "sales tags itself",
        )
    })

    it("finds bands out of order", async () => {
        const subject = await buildSubject()

        expect(subject.officeIssuesOf(HAKUEN_OFFICE, withRule({ auto_max: 20, ask_max: 15 }))).toContain(
            "give_discount has bands out of order",
        )
    })

    it("accepts a rule that never acts alone", async () => {
        const subject = await buildSubject()

        expect(subject.officeIssuesOf(HAKUEN_OFFICE, withRule({ auto_max: null }))).toEqual([])
    })

    it("finds a grant for an action no rule has", async () => {
        const subject = await buildSubject()
        const grants = [{ member: "nam" as const, action: "wire_money", unit: "vnd" as const, limit: 1 }]

        expect(subject.officeIssuesOf(HAKUEN_OFFICE, { ...HAKUEN_OFFICE_AUTHORITY, grants })).toEqual([
            "a grant names the action wire_money that no rule has",
        ])
    })
})
