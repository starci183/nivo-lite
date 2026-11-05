import { Test } from "@nestjs/testing"
import { readTestAccountsSeed } from "./test-accounts-seed.policy"
import { ConnectionsError, ConnectionsErrorCode } from "@modules/domain/connections"
import { TEST_ACCOUNTS_SEED_SCHEMA } from "./test-accounts-seed.contracts"

const refused = (field: string) =>
    new ConnectionsError({ code: ConnectionsErrorCode.CommandInvalid, params: { field } })

const secret = (name: string): string => `${name}-value`
const SEALED = {
    A_OWNER_EMAIL: "Owner-A@example.test",
    A_OWNER_PASSWORD: secret("a-owner"),
    A_STAFF_EMAIL: "staff-a@example.test",
    A_STAFF_PASSWORD: secret("a-staff"),
    B_OWNER_EMAIL: "owner-b@example.test",
    B_OWNER_PASSWORD: secret("b-owner"),
}
const seat = (role: string, key: string) => ({
    role,
    name: `${key} seat`,
    emailKey: `${key}_EMAIL`,
    passwordKey: `${key}_PASSWORD`,
})
const document = (overrides: Record<string, unknown> = {}) => ({
    schema: TEST_ACCOUNTS_SEED_SCHEMA,
    workspaces: [
        { name: "Alpha", seats: [seat("owner", "A_OWNER"), seat("staff", "A_STAFF")] },
        { name: "Beta", seats: [seat("owner", "B_OWNER")] },
    ],
    values: SEALED,
    ...overrides,
})

const SUBJECT = Symbol("test-accounts-seed.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { readTestAccountsSeed } }],
    }).compile()
    return moduleRef.get<typeof import("./test-accounts-seed.policy")>(SUBJECT)
}

describe("readTestAccountsSeed", () => {
    let policy: typeof import("./test-accounts-seed.policy")

    beforeAll(async () => {
        policy = await build()
    })

    it("reads each workspace with its owner first, the addresses lower-cased and the passwords opened from the values", () => {
        const { workspaces } = policy.readTestAccountsSeed(document())

        expect(workspaces.map((workspace) => workspace.name)).toEqual(["Alpha", "Beta"])
        expect(workspaces[0]?.owner).toEqual({
            role: "owner",
            name: "A_OWNER seat",
            email: "owner-a@example.test",
            password: secret("a-owner"),
        })
        expect(workspaces[0]?.others.map((other) => [other.role, other.email])).toEqual([
            ["staff", "staff-a@example.test"],
        ])
        expect(workspaces[1]?.others).toEqual([])
    })

    it.each([
        ["not an object", "x", "schema"],
        ["another schema", { ...document(), schema: "nivo/management-seed@1" }, "schema"],
        ["no workspaces", document({ workspaces: [] }), "workspaces"],
        ["a workspace that is not an object", document({ workspaces: ["x"] }), "workspace"],
        ["a workspace without seats", document({ workspaces: [{ name: "Alpha", seats: [] }] }), "workspace.seats"],
        ["a seat that is not an object", document({ workspaces: [{ name: "Alpha", seats: ["x"] }] }), "seat"],
        [
            "an owner that is not first",
            document({ workspaces: [{ name: "Alpha", seats: [seat("staff", "A_STAFF"), seat("owner", "A_OWNER")] }] }),
            "workspace.owner",
        ],
        [
            "two owners",
            document({ workspaces: [{ name: "Alpha", seats: [seat("owner", "A_OWNER"), seat("owner", "B_OWNER")] }] }),
            "workspace.owner",
        ],
        [
            "a role that does not exist",
            document({ workspaces: [{ name: "Alpha", seats: [seat("admin", "A_OWNER")] }] }),
            "seat.role",
        ],
        [
            "a key the sealed values lack",
            document({ workspaces: [{ name: "Alpha", seats: [seat("owner", "MISSING")] }] }),
            "seat.emailKey",
        ],
        [
            "a password key the sealed values lack",
            document({
                workspaces: [
                    { name: "Alpha", seats: [{ ...seat("owner", "A_OWNER"), passwordKey: "MISSING_PASSWORD" }] },
                ],
            }),
            "seat.passwordKey",
        ],
        [
            "an address that is not one",
            document({ values: { ...SEALED, A_OWNER_EMAIL: "not-an-address" } }),
            "seat.email",
        ],
        [
            "an address used by two seats",
            document({ values: { ...SEALED, B_OWNER_EMAIL: "owner-a@example.test" } }),
            "seat.email",
        ],
    ])("refuses %s", (_name, input, field) => {
        expect(() => policy.readTestAccountsSeed(input)).toThrow(refused(field))
    })
})
