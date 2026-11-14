import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import type {
    ActionDefinition,
    ActionResult,
    InputProblem,
    ListShape,
    ListSource,
    ReadDefinition,
    ReadRunResult,
} from "@nivo-lite/agent-sdk/block"
import { SdkDefinitionError } from "@nivo-lite/agent-sdk/block"
import type { EntityDefinition } from "@nivo-lite/agent-sdk/entity"
import { listRead } from "@nivo-lite/agent-sdk/module"
import type { ModuleDeclaration } from "@nivo-lite/agent-sdk/module"
import { definePort } from "@nivo-lite/agent-sdk/port"
import type { PortProvider } from "@nivo-lite/agent-sdk/port"
import {
    EntityEngineError,
    EntityEngineErrorCode,
    EntityEngineService,
    ModuleAgentService,
} from "@modules/domain/entity-engine"
import type { ScopedTx } from "@modules/domain/entity-engine"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceMember, WorkspaceRole } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { DomainError } from "@modules/platform/errors"
import { parseJsonText } from "@modules/platform/primitives"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { DoorPortsService } from "./door-ports.service"
import { DoorProviderReadsService } from "./door-provider-reads.service"
import { WorkspaceTimeZoneService } from "@modules/domain/workspace-settings"
import type { DoorRun } from "./door-ports.service"
import { WORKBENCH_DOOR_OPTIONS } from "./workbench-door.decorators"
import { WorkbenchDoorErrorCode } from "./errors/workbench-door.error"
import type { DoorAnswer, DoorCall } from "./workbench-door.contracts"
import { WorkbenchDoorLogEvent } from "./workbench-door.log-events"
import { WorkbenchDoorService } from "./workbench-door.service"

class StandInError extends DomainError<string> {}

const SHAPE: ListShape = {
    sort: { recent: [["updatedAt", "desc"]] },
    page: { size: 30 },
    row: { id: "id", title: "name" },
}

const LEADS = listRead({
    id: "sales.leads",
    dataKind: "lead",
    permission: "sales.view",
    fields: ["id", "name"],
    list: SHAPE,
    source: definePort<ListSource<unknown>>("sales.leads-list"),
})

const WORKSPACE = "ws-1"
const NOW = "2026-11-05T03:00:00.000Z"

const ACTION_OK: ActionResult = { ok: true, data: { id: "lead-1" } }

const actionOf = (
    id: ActionDefinition["id"],
    execute: ActionDefinition["execute"],
    transactional = false,
    staff = false,
): ActionDefinition => ({
    entry: "action",
    id,
    operation: id,
    permission: "sales.manage",
    label: { key: "sales.label" },
    transactional,
    execute,
    ...(staff ? { staff: true as const } : {}),
})

const memberOf = (role: WorkspaceRole): WorkspaceMember => ({
    userId: "user-1",
    workspaceId: WORKSPACE,
    role,
    staffId: null,
    displayName: "An",
    status: "active",
})

const SALES_AGENT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"

interface Arranged {
    readonly role?: WorkspaceRole
    readonly read?: ReadDefinition["execute"]
    readonly act?: ActionDefinition["execute"]
    readonly transactionalAct?: ActionDefinition["execute"]
    /** The agent of the workspace's installed sales module; null when it has none, undefined for the default agent. */
    readonly agentId?: string | null
}

const build = async ({
    role = "manager",
    read = () => Promise.resolve({ ok: true, data: { rows: [] } }),
    act = () => Promise.resolve(ACTION_OK),
    transactionalAct = () => Promise.resolve(ACTION_OK),
    agentId = SALES_AGENT,
}: Arranged = {}) => {
    const declaration: ModuleDeclaration = {
        entry: "module",
        key: "sales",
        namespace: "sales",
        permissions: ["sales.view", "sales.manage"],
        reads: [{ ...LEADS, execute: read }],
        actions: [
            actionOf("sales.move-stage", act),
            actionOf("sales.settle", transactionalAct, true),
            actionOf("sales.note-add", act, false, true),
        ],
        specs: [],
    }
    const lead = mock<EntityDefinition>({ name: "sales.lead", dataKind: "lead" })
    const tx = mock<ScopedTx>()
    const members = mock<WorkspaceMembersService>()
    members.require.mockResolvedValue(memberOf(role))
    members.idOf.mockResolvedValue("member-1")
    const engine = mock<EntityEngineService>()
    engine.scoped.mockImplementation((_workspace, work) => work(tx))
    const installations = mock<InstallationRecordsService>()
    const agents = mock<ModuleAgentService>()
    if (agentId === null)
        agents.scopeOf.mockRejectedValue(new EntityEngineError({ code: EntityEngineErrorCode.AgentMissing }))
    else agents.scopeOf.mockResolvedValue({ id: agentId, sees: "all" })
    const provider = mock<PortProvider>()
    const ports = mock<DoorPortsService>()
    const zones = mock<WorkspaceTimeZoneService>({ timeZoneOf: jest.fn().mockResolvedValue("Asia/Ho_Chi_Minh") })
    ports.providerFor.mockReturnValue(provider)
    const catalog = mock<MessageCatalog>({
        get: jest.fn((key: string, _params: unknown, locale: string) => `${locale}:${key}`),
    })
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            WorkbenchDoorService,
            {
                provide: WORKBENCH_DOOR_OPTIONS,
                useValue: { modules: [declaration], entities: [lead], registryHash: "hash-1" },
            },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: LOGGER, useValue: logger },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: EntityEngineService, useValue: engine },
            { provide: DoorPortsService, useValue: ports },
            DoorProviderReadsService,
            { provide: WorkspaceTimeZoneService, useValue: zones },
            { provide: InstallationRecordsService, useValue: installations },
            { provide: ModuleAgentService, useValue: agents },
        ],
    }).compile()
    return {
        door: moduleRef.get(WorkbenchDoorService),
        members,
        engine,
        agents,
        ports,
        provider,
        logger,
        tx,
    }
}

const USER = "user-1"

const RUN_CONTEXT = {
    workspaceId: WORKSPACE,
    memberId: "member-1",
    now: new Date(NOW),
    timeZone: "Asia/Ho_Chi_Minh",
    locale: "vi",
}

const callOf = (name: string, payload = "{}"): DoorCall => ({ workspaceId: WORKSPACE, name, payload, locale: "vi" })

/** The JSON text of an answer, read back. */
const parsed = (answer: DoorAnswer): unknown => {
    const read = parseJsonText(answer.data)
    return read.ok ? read.value : undefined
}

const failure = (reason: string, code: WorkbenchDoorErrorCode, data?: unknown): unknown => ({
    ok: false,
    reason,
    message: { vi: `vi:errors.${code}`, en: `en:errors.${code}` },
    ...(data === undefined ? {} : { data }),
})

describe("WorkbenchDoorService.read", () => {
    it("runs the read in the scope of the proven workspace on the ports of the run, and answers its data as JSON text", async () => {
        const read = jest.fn((): Promise<ReadRunResult> =>
            Promise.resolve({ ok: true, data: { rows: [{ id: "lead-1" }] } }),
        )
        const { door, engine, ports, provider, tx } = await build({ role: "staff", read })

        const answer = await door.read(USER, callOf("sales.leads", '{"q":"an"}'))

        expect(answer).toEqual({ data: '{"rows":[{"id":"lead-1"}]}' })
        expect(engine.scoped).toHaveBeenCalledWith(WORKSPACE, expect.any(Function))
        const run: DoorRun | undefined = ports.providerFor.mock.calls[0]?.[0]
        expect(run).toMatchObject({ name: "sales.leads", dataKind: "lead" })
        await expect(run?.runIn((scoped) => Promise.resolve(scoped))).resolves.toBe(tx)
        expect(read).toHaveBeenCalledWith(provider, { q: "an" }, RUN_CONTEXT)
    })

    it("refuses a caller who is not a member before it looks at the name, the permission or the payload", async () => {
        const { door, members, engine } = await build()
        members.require.mockRejectedValue(new StandInError({ code: "WORKSPACE_MEMBERS_NOT_MEMBER" }))

        await expect(door.read(USER, callOf("sales.nothing", "not json"))).rejects.toMatchObject({
            code: "WORKSPACE_MEMBERS_NOT_MEMBER",
        })
        expect(engine.scoped).not.toHaveBeenCalled()
    })

    it("answers not found for a read no module declares", async () => {
        const { door } = await build()

        await expect(door.read(USER, callOf("sales.nothing"))).rejects.toMatchObject({
            code: WorkbenchDoorErrorCode.ReadUnknown,
            params: { name: "sales.nothing" },
        })
    })

    it.each(["owner", "manager", "staff"] as const)(
        "lets a %s view every declared read: the door judges a read by membership alone",
        async (role) => {
            const read = jest.fn((): Promise<ReadRunResult> => Promise.resolve({ ok: true, data: { rows: [] } }))
            const { door } = await build({ role, read })

            await expect(door.read(USER, callOf("sales.leads"))).resolves.toEqual({ data: '{"rows":[]}' })
            expect(read).toHaveBeenCalledTimes(1)
        },
    )

    it("refuses a member of another workspace: membership is proved for the workspace of the call", async () => {
        const { door, members, engine } = await build({ role: "staff" })
        members.require.mockImplementation((_user, workspaceId) =>
            workspaceId === WORKSPACE
                ? Promise.resolve(memberOf("staff"))
                : Promise.reject(new StandInError({ code: "WORKSPACE_MEMBERS_NOT_MEMBER" })),
        )

        await expect(
            door.read(USER, { workspaceId: "ws-2", name: "sales.leads", payload: "{}", locale: "vi" }),
        ).rejects.toMatchObject({ code: "WORKSPACE_MEMBERS_NOT_MEMBER" })
        expect(engine.scoped).not.toHaveBeenCalled()
    })
})

describe("WorkbenchDoorService.read refusals", () => {
    it("refuses a payload that is not a JSON object as invalid", async () => {
        const { door, engine } = await build()

        await expect(door.read(USER, callOf("sales.leads", "{q:"))).rejects.toMatchObject({
            code: WorkbenchDoorErrorCode.PayloadInvalid,
            params: { issues: "." },
        })
        expect(engine.scoped).not.toHaveBeenCalled()
    })

    it("names the variables the read refused as invalid, by code and path", async () => {
        const problems: ReadonlyArray<InputProblem> = [
            { code: "INPUT_UNKNOWN_KEY", at: "workspaceId" },
            { code: "INPUT_INVALID", at: "q" },
        ]
        const { door } = await build({ read: () => Promise.resolve({ ok: false, problems }) })

        await expect(door.read(USER, callOf("sales.leads", '{"workspaceId":"ws-2","q":4}'))).rejects.toMatchObject({
            code: WorkbenchDoorErrorCode.PayloadInvalid,
            params: { issues: "INPUT_UNKNOWN_KEY:workspaceId,INPUT_INVALID:q" },
        })
    })

    it("reports a port the door does not provide as an internal failure and logs the gap", async () => {
        const unprovided = new SdkDefinitionError("PORT_UNPROVIDED", "sales.pricing")
        const { door, logger } = await build({ read: () => Promise.reject(unprovided) })

        await expect(door.read(USER, callOf("sales.leads"))).rejects.toMatchObject({
            code: WorkbenchDoorErrorCode.PortUnprovided,
            params: { port: "sales.pricing" },
        })
        expect(logger.warn).toHaveBeenCalledWith(WorkbenchDoorLogEvent.PortUnprovided, {
            code: "PORT_UNPROVIDED",
            at: "sales.pricing",
        })
    })

    it("lets any other failure of the read propagate to the error filter", async () => {
        const broken = new StandInError({ code: "WORKBENCH_DOOR_TEST_UNKNOWN" })
        const { door } = await build({ read: () => Promise.reject(broken) })

        await expect(door.read(USER, callOf("sales.leads"))).rejects.toBe(broken)
    })
})

const FAILURE_REASONS: ReadonlyArray<"conflict" | "invalid" | "failed" | "forbidden" | "refused"> = ["conflict", "invalid", "failed", "forbidden", "refused"]

describe("WorkbenchDoorService.act", () => {
    it("runs an action that is not transactional with a transaction of its own per port call", async () => {
        const act = jest.fn(() => Promise.resolve(ACTION_OK))
        const { door, engine, ports, provider, tx } = await build({ act })

        const answer = await door.act(USER, callOf("sales.move-stage", '{"id":"lead-1"}'))

        expect(parsed(answer)).toEqual(ACTION_OK)
        expect(act).toHaveBeenCalledWith(provider, { id: "lead-1" }, RUN_CONTEXT)
        expect(engine.scoped).not.toHaveBeenCalled()
        const run: DoorRun | undefined = ports.providerFor.mock.calls[0]?.[0]
        expect(run).toMatchObject({ name: "sales.move-stage", dataKind: null })
        await expect(run?.runIn((scoped) => Promise.resolve(scoped))).resolves.toBe(tx)
        expect(engine.scoped).toHaveBeenCalledWith(WORKSPACE, expect.any(Function), { id: SALES_AGENT, sees: "all" })
    })

    it("stamps a person's write for the installed agent of the action's module, who still sees every record their rights allow", async () => {
        const { door, engine, agents, ports } = await build({})

        await door.act(USER, callOf("sales.move-stage", '{"id":"lead-1"}'))
        const run: DoorRun | undefined = ports.providerFor.mock.calls[0]?.[0]
        await run?.runIn((scoped) => Promise.resolve(scoped))

        expect(agents.scopeOf).toHaveBeenCalledWith(WORKSPACE, "sales", undefined)
        expect(engine.scoped).toHaveBeenCalledWith(WORKSPACE, expect.any(Function), { id: SALES_AGENT, sees: "all" })
    })

    it("stamps the write for the agent of the installation the screen carries", async () => {
        const { door, agents } = await build({})

        await door.act(USER, { ...callOf("sales.move-stage", '{"id":"lead-1"}'), installationId: "inst-2" })

        expect(agents.scopeOf).toHaveBeenCalledWith(WORKSPACE, "sales", "inst-2")
    })

    it("refuses the action, writing nothing, when the module has no installed agent in the workspace", async () => {
        const { door, engine, ports } = await build({ agentId: null })

        const answer = parsed(await door.act(USER, callOf("sales.move-stage", '{"id":"lead-1"}')))

        expect(answer).toMatchObject({ ok: false, reason: "forbidden" })
        expect(engine.scoped).not.toHaveBeenCalled()
        expect(ports.providerFor).not.toHaveBeenCalled()
    })

    it("runs a transactional action as one transaction whose ports all use it", async () => {
        const transactionalAct = jest.fn(() => Promise.resolve(ACTION_OK))
        const { door, engine, ports, tx } = await build({ transactionalAct })

        const answer = await door.act(USER, callOf("sales.settle"))

        expect(parsed(answer)).toEqual(ACTION_OK)
        expect(engine.scoped).toHaveBeenCalledTimes(1)
        const run: DoorRun | undefined = ports.providerFor.mock.calls[0]?.[0]
        await expect(run?.runIn((scoped) => Promise.resolve(scoped))).resolves.toBe(tx)
        expect(engine.scoped).toHaveBeenCalledTimes(1)
    })

    it("answers a refusal of an action that is not transactional as it is", async () => {
        const refusal: ActionResult = { ok: false, reason: "conflict", message: { key: "sales.stale" } }
        const { door } = await build({ act: () => Promise.resolve(refusal) })

        expect(parsed(await door.act(USER, callOf("sales.move-stage")))).toEqual(refusal)
    })
})

describe("WorkbenchDoorService.act rollback", () => {
    it.each(FAILURE_REASONS)(
        "rolls a transactional action back after its write when it answers %s, so no row stays",
        async (reason) => {
            const rows: Array<string> = []
            const answered: ActionResult = { ok: false, reason, message: { key: "sales.stale" } }
            const { door, engine } = await build({
                transactionalAct: () => {
                    rows.push("order")
                    return Promise.resolve(answered)
                },
            })
            engine.scoped.mockImplementation(async (_workspace, work) => {
                const before = rows.length
                try {
                    return await work(mock<ScopedTx>())
                } catch (cause) {
                    rows.length = before
                    throw cause
                }
            })

            const answer = await door.act(USER, callOf("sales.settle"))

            expect(parsed(answer)).toEqual(answered)
            expect(rows).toEqual([])
            await expect(engine.scoped.mock.results[0]?.value).rejects.toMatchObject({
                code: WorkbenchDoorErrorCode.ActionRefused,
            })
        },
    )
})

describe("WorkbenchDoorService.act refusals", () => {
    it("refuses a caller who is not a member before it looks at the name", async () => {
        const { door, members, engine } = await build()
        members.require.mockRejectedValue(new StandInError({ code: "WORKSPACE_MEMBERS_NOT_MEMBER" }))

        await expect(door.act(USER, callOf("sales.nothing"))).rejects.toMatchObject({
            code: "WORKSPACE_MEMBERS_NOT_MEMBER",
        })
        expect(engine.scoped).not.toHaveBeenCalled()
    })

    it("answers not found for an action no module declares", async () => {
        const { door } = await build()

        await expect(door.act(USER, callOf("sales.nothing"))).rejects.toMatchObject({
            code: WorkbenchDoorErrorCode.ActionUnknown,
            params: { name: "sales.nothing" },
        })
    })

    it("answers forbidden to a staff member for an action that carries no staff mark, and never runs it", async () => {
        const act = jest.fn()
        const { door } = await build({ role: "staff", act })

        const answer = await door.act(USER, callOf("sales.move-stage"))

        expect(parsed(answer)).toEqual(failure("forbidden", WorkbenchDoorErrorCode.PermissionDenied))
        expect(act).not.toHaveBeenCalled()
    })

    it("lets a staff member run an action that declares the staff mark", async () => {
        const act = jest.fn(() => Promise.resolve(ACTION_OK))
        const { door } = await build({ role: "staff", act })

        const answer = await door.act(USER, callOf("sales.note-add"))

        expect(parsed(answer)).toEqual(ACTION_OK)
        expect(act).toHaveBeenCalledTimes(1)
    })

    it.each(["owner", "manager"] as const)("lets a %s run an action whether or not it carries the staff mark", async (role) => {
        const act = jest.fn(() => Promise.resolve(ACTION_OK))
        const { door } = await build({ role, act })

        expect(parsed(await door.act(USER, callOf("sales.move-stage")))).toEqual(ACTION_OK)
        expect(parsed(await door.act(USER, callOf("sales.note-add")))).toEqual(ACTION_OK)
        expect(act).toHaveBeenCalledTimes(2)
    })

    it("refuses a member of another workspace an action, even one with the staff mark, and never runs it", async () => {
        const act = jest.fn()
        const { door, members } = await build({ role: "staff", act })
        members.require.mockRejectedValue(new StandInError({ code: "WORKSPACE_MEMBERS_NOT_MEMBER" }))

        await expect(
            door.act(USER, { workspaceId: "ws-2", name: "sales.note-add", payload: "{}", locale: "vi" }),
        ).rejects.toMatchObject({ code: "WORKSPACE_MEMBERS_NOT_MEMBER" })
        expect(act).not.toHaveBeenCalled()
    })

    it("answers invalid with the words of the payload refusal when the payload is not a JSON object", async () => {
        const act = jest.fn()
        const { door } = await build({ act })

        const answer = await door.act(USER, callOf("sales.move-stage", "[]"))

        expect(parsed(answer)).toEqual(failure("invalid", WorkbenchDoorErrorCode.PayloadInvalid))
        expect(act).not.toHaveBeenCalled()
    })

    it("logs the action and the field keys of an input it refused", async () => {
        const [message, fields] = [{ key: "invalid" }, { order: { key: "invalid" } }]
        const act = (): Promise<ActionResult> => Promise.resolve({ ok: false, reason: "invalid", message, fields })
        const { door, logger } = await build({ act })
        await door.act(USER, callOf("sales.move-stage", '{"id":"lead-1"}'))
        const meta = { action: "sales.move-stage", fields: ["order"] }
        expect(logger.warn).toHaveBeenCalledWith(WorkbenchDoorLogEvent.InputInvalid, meta)
    })
})
describe("WorkbenchDoorService.act failures", () => {
    it("runs an action whose permission the member holds, with an amount in its input: no rule gate stands between", async () => {
        const act = jest.fn(() => Promise.resolve(ACTION_OK))
        const { door } = await build({ act })

        const answer = await door.act(USER, callOf("sales.move-stage", '{"amount_vnd":1500000}'))

        expect(parsed(answer)).toEqual(ACTION_OK)
        expect(act).toHaveBeenCalledTimes(1)
    })

    it.each([
        ["ENTITY_ENGINE_QUERY_INVALID", "invalid", WorkbenchDoorErrorCode.PayloadInvalid, undefined],
        ["ENTITY_ENGINE_SCOPE_VIOLATION", "forbidden", WorkbenchDoorErrorCode.PermissionDenied, undefined],
        ["ENTITY_ENGINE_CONSTRAINT_UNDECLARED", "conflict", WorkbenchDoorErrorCode.ActionConflict, undefined],
        ["ENTITY_ENGINE_UNAVAILABLE", "failed", WorkbenchDoorErrorCode.ActionFailed, { retry: true }],
    ])("answers an engine failure %s as %s", async (code, reason, text, data) => {
        const { door } = await build({ act: () => Promise.reject(new StandInError({ code })) })

        const answer = await door.act(USER, callOf("sales.move-stage"))

        expect(parsed(answer)).toEqual(failure(reason, text, data))
    })

    it("answers failed, with what invokeAction names, for a port the door does not provide", async () => {
        const unprovided = new SdkDefinitionError("PORT_UNPROVIDED", "sales.pricing")
        const { door } = await build({ act: () => Promise.reject(unprovided) })

        const answer = await door.act(USER, callOf("sales.move-stage"))

        expect(parsed(answer)).toEqual({
            ok: false,
            reason: "failed",
            message: { key: "invoke.failed" },
            data: { code: "PORT_UNPROVIDED", at: "sales.pricing" },
        })
    })

    it("lets a failure the door does not know propagate to the error filter", async () => {
        const broken = new StandInError({ code: "WORKBENCH_DOOR_TEST_UNKNOWN" })
        const { door } = await build({ act: () => Promise.reject(broken) })

        await expect(door.act(USER, callOf("sales.move-stage"))).rejects.toBe(broken)
    })
})
