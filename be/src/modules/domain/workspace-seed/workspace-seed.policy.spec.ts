import { Test } from "@nestjs/testing"
import { Secret } from "@modules/platform/config"
import { WorkspaceSeedError, WorkspaceSeedErrorCode } from "./errors/workspace-seed.error"
import { assertSeedScope, readSeedInput } from "./workspace-seed.policy"

const SUBJECT = Symbol("workspace-seed.policy")
const WS = "11111111-1111-4111-8111-111111111111"
const USER = "22222222-2222-4222-8222-222222222222"
const ACCOUNT = { email: "owner@example.test", name: " Owner ", password: "private-owner" }
const WIRE = {
    schema: "starci/app-workspace-input@1",
    action: "ensure",
    workspaceId: WS,
    owner: ACCOUNT,
    manager: { email: "manager@example.test", name: "Manager" },
    staff: { email: "staff@example.test", name: "Staff" },
}
const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { readSeedInput, assertSeedScope } }],
    }).compile()
    return moduleRef.get<{ readSeedInput: typeof readSeedInput; assertSeedScope: typeof assertSeedScope }>(SUBJECT)
}

describe("workspace seed private input", () => {
    it("wraps credentials as secrets and normalizes public account identity", async () => {
        const subject = await build()
        const parsed = subject.readSeedInput(
            new Secret(JSON.stringify({ ...WIRE, owner: { ...ACCOUNT, email: "OWNER@EXAMPLE.TEST" } })),
        )
        expect(parsed).toMatchObject({
            action: "ensure",
            request: { workspaceId: WS, owner: { email: "owner@example.test", name: "Owner" } },
        })
        expect(JSON.stringify(parsed)).not.toContain("private-owner")
    })

    it("accepts an explicit name and session without requiring replacement account passwords", async () => {
        const subject = await build()
        expect(
            subject.readSeedInput(
                new Secret(
                    JSON.stringify({
                        ...WIRE,
                        workspaceId: undefined,
                        workspaceName: " Example ",
                        principalToken: "session",
                    }),
                ),
            ),
        ).toMatchObject({ action: "ensure", request: { workspaceName: "Example" } })
    })

    it.each([true, false])("freezes explicit first-owner bootstrap=%s in the public scope", async (bootstrapOwner) => {
        const subject = await build()
        expect(subject.readSeedInput(new Secret(JSON.stringify({ ...WIRE, bootstrapOwner })))).toMatchObject({
            action: "ensure",
            request: { bootstrapOwner },
        })
    })
})

describe("workspace seed session scope", () => {
    it.each(["owner", "manager", "staff"])("accepts an explicit %s role without an actor id", async (role) => {
        const subject = await build()
        const parsed = subject.readSeedInput(
            new Secret(
                JSON.stringify({
                    schema: WIRE.schema,
                    action: "role",
                    workspaceId: WS,
                    memberId: USER,
                    role,
                    principalToken: "private-session",
                }),
            ),
        )
        expect(parsed).toMatchObject({ action: "role", request: { role } })
        expect(JSON.stringify(parsed)).not.toContain("private-session")
    })

    it("requires private input without echoing malformed content", async () => {
        const subject = await build()
        expect(() => subject.readSeedInput(undefined)).toThrow(
            expect.objectContaining({ code: WorkspaceSeedErrorCode.InputRequired }),
        )
        expect(() => subject.readSeedInput(new Secret("{private-password"))).toThrow(
            expect.objectContaining({ code: WorkspaceSeedErrorCode.InputInvalid }),
        )
    })
})

describe("workspace seed input refusal", () => {
    it.each([
        null,
        [],
        { ...WIRE, schema: "wrong" },
        { ...WIRE, action: "unknown" },
        { ...WIRE, workspaceId: undefined },
        { ...WIRE, workspaceName: "other" },
        { ...WIRE, workspaceId: "bad" },
        { ...WIRE, workspaceId: undefined, workspaceName: " " },
        { ...WIRE, workspaceId: undefined, workspaceName: "x".repeat(121) },
        { ...WIRE, actorId: USER },
        { ...WIRE, owner: null },
        { ...WIRE, bootstrapOwner: "yes" },
        { ...WIRE, owner: { ...ACCOUNT, extra: "no" } },
        { ...WIRE, owner: { ...ACCOUNT, email: "invalid" } },
        { ...WIRE, owner: { ...ACCOUNT, email: 1 } },
        { ...WIRE, owner: { ...ACCOUNT, name: " " } },
        { ...WIRE, owner: { ...ACCOUNT, password: "" } },
        { ...WIRE, principalToken: "x".repeat(65_537) },
        { ...WIRE, manager: { email: ACCOUNT.email, name: "Duplicate" } },
        {
            schema: WIRE.schema,
            action: "role",
            workspaceId: WS,
            memberId: "bad",
            role: "owner",
            principalToken: "session",
        },
        {
            schema: WIRE.schema,
            action: "role",
            workspaceId: "bad",
            memberId: USER,
            role: "owner",
            principalToken: "session",
        },
        {
            schema: WIRE.schema,
            action: "role",
            workspaceId: WS,
            memberId: USER,
            role: "admin",
            principalToken: "session",
        },
        {
            schema: WIRE.schema,
            action: "role",
            workspaceId: WS,
            memberId: USER,
            role: "owner",
            actorId: USER,
            principalToken: "session",
        },
        { schema: WIRE.schema, action: "role", workspaceId: WS, memberId: USER, role: "owner" },
    ])("refuses invalid or authority-bearing input %#", async (wire) => {
        const subject = await build()
        expect(() => subject.readSeedInput(new Secret(JSON.stringify(wire)))).toThrow(
            expect.objectContaining({ code: WorkspaceSeedErrorCode.InputInvalid }),
        )
    })
})

describe("workspace seed domain selector", () => {
    it("holds the same selector invariants at the domain boundary", async () => {
        const subject = await build()
        const parsed = subject.readSeedInput(new Secret(JSON.stringify(WIRE)))
        if (parsed.action !== "ensure") throw new WorkspaceSeedError({ code: WorkspaceSeedErrorCode.InputInvalid })
        expect(() => subject.assertSeedScope(parsed.request)).not.toThrow()
        expect(() => subject.assertSeedScope({ ...parsed.request, workspaceId: undefined })).toThrow()
        expect(() => subject.assertSeedScope({ ...parsed.request, workspaceId: "bad" })).toThrow()
        expect(() => subject.assertSeedScope({ ...parsed.request, workspaceName: "Both selectors" })).toThrow()
        expect(() =>
            subject.assertSeedScope({ ...parsed.request, workspaceId: undefined, workspaceName: " " }),
        ).toThrow()
        expect(() =>
            subject.assertSeedScope({ ...parsed.request, workspaceId: undefined, workspaceName: "x".repeat(121) }),
        ).toThrow()
        expect(() => subject.assertSeedScope({ ...parsed.request, manager: parsed.request.owner })).toThrow()
        expect(() =>
            subject.assertSeedScope({ ...parsed.request, workspaceId: undefined, workspaceName: "Named" }),
        ).not.toThrow()
    })
})
