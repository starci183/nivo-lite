import { Test } from "@nestjs/testing"
import { Secret } from "@modules/platform/config"
import { WorkspaceSeedError, WorkspaceSeedErrorCode } from "./errors/workspace-seed.error"
import { assertSeedScope, readEnsureFor, readProfileInput, readSeedInput } from "./workspace-seed.policy"

/** A partial-object matcher, typed `unknown` so it flows into any slot. */
const objectLike = (shape: Record<string, unknown>): unknown => expect.objectContaining(shape)

/** What `run` throws, read as `unknown`; the matcher then judges its fields. */
const thrownBy = (run: () => unknown): unknown => {
    try {
        run()
    } catch (error) {
        return error
    }
    return undefined
}

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
        providers: [
            { provide: SUBJECT, useValue: { readSeedInput, assertSeedScope, readProfileInput, readEnsureFor } },
        ],
    }).compile()
    return moduleRef.get<{
        readSeedInput: typeof readSeedInput
        assertSeedScope: typeof assertSeedScope
        readProfileInput: typeof readProfileInput
        readEnsureFor: typeof readEnsureFor
    }>(SUBJECT)
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
        expect(thrownBy(() => subject.readSeedInput(undefined))).toEqual(
            objectLike({ code: WorkspaceSeedErrorCode.InputRequired }),
        )
        expect(thrownBy(() => subject.readSeedInput(new Secret("{private-password")))).toEqual(
            objectLike({ code: WorkspaceSeedErrorCode.InputInvalid }),
        )
    })
})

describe("workspace seed input refusal", () => {
    it.each([
        null,
        [],
        "private-scalar",
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
        expect(thrownBy(() => subject.readSeedInput(new Secret(JSON.stringify(wire))))).toEqual(
            objectLike({ code: WorkspaceSeedErrorCode.InputInvalid }),
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

describe("workspace profile private input", () => {
    const PROFILE_WIRE = {
        schema: "nivo/workspace-profile-input@1",
        connectors: { hakuen: { url: "https://mcp.example.test/mcp" } },
    }
    const secretOf = (value: unknown) => new Secret(JSON.stringify(value))

    it("answers the endpoint of each connector by key", async () => {
        const subject = await build()
        expect(subject.readProfileInput(secretOf(PROFILE_WIRE)).urls).toEqual(
            new Map([["hakuen", "https://mcp.example.test/mcp"]]),
        )
    })

    it.each(["http://localhost:23002/mcp", "http://127.0.0.1:23002/mcp", "http://[::1]:23002/mcp"])(
        "accepts plain http to the loopback host of a local stack: %s",
        async (url) => {
            const subject = await build()
            expect(
                subject
                    .readProfileInput(secretOf({ ...PROFILE_WIRE, connectors: { hakuen: { url } } }))
                    .urls.get("hakuen"),
            ).toBe(url)
        },
    )

    it("requires the input", async () => {
        const subject = await build()
        expect(thrownBy(() => subject.readProfileInput(undefined))).toEqual(
            objectLike({ code: WorkspaceSeedErrorCode.InputRequired }),
        )
    })

    it.each([
        ["text that is not JSON", "{"],
        ["another schema", JSON.stringify({ ...PROFILE_WIRE, schema: "other@1" })],
        ["an array", JSON.stringify([PROFILE_WIRE])],
        ["an unknown top-level key", JSON.stringify({ ...PROFILE_WIRE, extra: true })],
        ["connectors that are not an object", JSON.stringify({ ...PROFILE_WIRE, connectors: [] })],
        [
            "a malformed connector key",
            JSON.stringify({ ...PROFILE_WIRE, connectors: { Hakuen: { url: "https://a.test" } } }),
        ],
        [
            "a connector that is not an object",
            JSON.stringify({ ...PROFILE_WIRE, connectors: { hakuen: "https://a.test" } }),
        ],
        [
            "an unknown connector field",
            JSON.stringify({ ...PROFILE_WIRE, connectors: { hakuen: { url: "https://a.test", token: "x" } } }),
        ],
        ["a missing url", JSON.stringify({ ...PROFILE_WIRE, connectors: { hakuen: {} } })],
        [
            "a plain http url to a remote host",
            JSON.stringify({ ...PROFILE_WIRE, connectors: { hakuen: { url: "http://a.test" } } }),
        ],
        ["another protocol", JSON.stringify({ ...PROFILE_WIRE, connectors: { hakuen: { url: "ftp://a.test" } } })],
        ["text that is no url", JSON.stringify({ ...PROFILE_WIRE, connectors: { hakuen: { url: "not a url" } } })],
    ])("refuses %s without echoing it", async (_name, wire) => {
        const subject = await build()
        expect(() => subject.readProfileInput(new Secret(wire))).toThrow(WorkspaceSeedError)
        expect(thrownBy(() => subject.readProfileInput(new Secret(wire)))).toEqual(
            objectLike({ code: WorkspaceSeedErrorCode.InputInvalid }),
        )
    })
})

describe("workspace seed ensure input bound to a workspace and an owner", () => {
    const NAMED = { ...WIRE, workspaceId: undefined, workspaceName: "Named Workspace" }
    const secretOf = (value: unknown): Secret => new Secret(JSON.stringify(value))

    it("answers the request when the owner and the workspace name match, ignoring case and spaces of the owner", async () => {
        const subject = await build()

        expect(subject.readEnsureFor(secretOf(NAMED), " OWNER@example.test ", "Named Workspace")).toMatchObject({
            workspaceName: "Named Workspace",
            owner: { email: "owner@example.test" },
        })
    })

    it.each([
        { name: "another owner", owner: "other@example.test", workspace: "Named Workspace" },
        { name: "no owner", owner: undefined, workspace: "Named Workspace" },
        { name: "another workspace", owner: "owner@example.test", workspace: "Production" },
    ])("refuses $name", async ({ owner, workspace }) => {
        const subject = await build()

        expect(() => subject.readEnsureFor(secretOf(NAMED), owner, workspace)).toThrow(WorkspaceSeedError)
    })

    it("refuses a role-change input", async () => {
        const subject = await build()
        const role = {
            schema: "starci/app-workspace-input@1",
            action: "role",
            workspaceId: WS,
            memberId: USER,
            role: "staff",
            principalToken: "token",
        }

        expect(() => subject.readEnsureFor(secretOf(role), "owner@example.test", "Named Workspace")).toThrow(
            WorkspaceSeedError,
        )
    })
})
