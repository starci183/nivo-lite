import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { NIVO_API } from "@nivo-lite/agent-sdk/names"
import { ApiKeysService } from "@modules/domain/api-keys"
import { NIVO_API_EXECUTOR } from "@modules/domain/nivo-api"
import type { NivoApiExecutor } from "@modules/domain/nivo-api"
import { ToolCallLogService } from "@modules/domain/tool-call-log"
import { ToolReceiptsService } from "@modules/domain/tool-receipts"
import type { ToolCallResult } from "@modules/domain/tools"
import { WorkspaceMemberSeatsService } from "@modules/domain/workspace-members"
import type { WorkspaceRole } from "@modules/domain/workspace-members"
import { MCP_SERVER } from "@modules/integrations/mcp"
import type { McpServing, McpSurface } from "@modules/integrations/mcp"
import { CLOCK } from "@modules/platform/clock"
import { McpEndpointErrorCode } from "./errors/mcp-endpoint.error"
import { McpSurfaceService } from "./mcp-surface.service"
import { TestWorldError, TestWorldErrorCode } from "@tests/world/test-world.error"

const WS = "11111111-1111-4111-8111-111111111111"
const CONTACT = "22222222-2222-4222-8222-222222222222"
const RUN = "44444444-4444-4444-8444-444444444444"

const HTTP = { method: "POST", url: "https://mcp.nivo.test/mcp", headers: {}, body: {} }

interface Scenario {
    readonly role?: WorkspaceRole | null
    readonly agentId?: string | null
    readonly key?: "working" | "gone"
}

const build = async (scenario: Scenario = {}) => {
    const keys = mock<ApiKeysService>()
    keys.heldMcpKey.mockResolvedValue(
        scenario.key === "gone"
            ? null
            : { keyId: "key-1", workspaceId: WS, holderId: "user-1", agentId: scenario.agentId ?? null },
    )
    const seats = mock<WorkspaceMemberSeatsService>()
    const role = scenario.role === undefined ? "owner" : scenario.role
    seats.activeSeatOfUser.mockResolvedValue(
        role === null ? null : { memberId: "m-1", userId: "user-1", role, displayName: "Lan", status: "active" },
    )
    const executor = mock<NivoApiExecutor>()
    executor.execute.mockResolvedValue({ ok: true, data: { contacts: [], next: null } })
    const callLog = mock<ToolCallLogService>()
    const receipts = mock<ToolReceiptsService>()
    receipts.run.mockImplementation((_ws, _key, operation: () => Promise<ToolCallResult>) => operation())
    let served: McpSurface | null = null
    const server = mock<McpServing>()
    server.serve.mockImplementation(({ surface }) => {
        served = surface
        return Promise.resolve({ status: 200, headers: {}, body: "" })
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            McpSurfaceService,
            { provide: MCP_SERVER, useValue: server },
            { provide: NIVO_API_EXECUTOR, useValue: executor },
            { provide: CLOCK, useValue: new FakeClock("2026-11-13T09:00:00.000Z") },
            { provide: ApiKeysService, useValue: keys },
            { provide: WorkspaceMemberSeatsService, useValue: seats },
            { provide: ToolCallLogService, useValue: callLog },
            { provide: ToolReceiptsService, useValue: receipts },
        ],
    }).compile()
    const service = moduleRef.get(McpSurfaceService)
    const surface = async (): Promise<McpSurface> => {
        await service.answer({ pathWorkspaceId: null, principal: { keyId: "key-1", workspaceId: WS }, http: HTTP })
        if (served === null) throw new TestWorldError({ code: TestWorldErrorCode.RowMissing, params: { what: "the surface was not served" } })
        return served
    }
    return { service, surface, keys, seats, executor, callLog, receipts }
}

/** Matches the list of issues a refusal carries. */
const ISSUES: unknown = expect.any(Array)

describe("McpSurfaceService tools", () => {
    it("lists the three discovery tools and the thirteen direct ops, every one annotated, with client-safe names", async () => {
        const { surface } = await build()

        const tools = (await surface()).tools

        expect(tools.map((tool) => tool.name)).toEqual([
            "nivo_search_ops",
            "nivo_describe_op",
            "nivo_call",
            "nivo_contact_list",
            "nivo_contact_get",
            "nivo_record_type_list",
            "nivo_workbench_read",
            "nivo_chat_thread_get",
            "nivo_brain_search",
            "nivo_run_list",
            "nivo_run_get",
            "nivo_workflow_run",
            "nivo_stop_list",
            "nivo_stop_answer",
            "nivo_run_step_decide",
            "nivo_file_link",
        ])
        expect(tools.filter((tool) => !/^[a-zA-Z0-9_-]{1,64}$/u.test(tool.name))).toEqual([])
        const hints = Object.fromEntries(
            tools.map((tool) => [tool.name, [tool.annotations.readOnlyHint, tool.annotations.destructiveHint]]),
        )
        expect(hints).toMatchObject({
            nivo_search_ops: [true, false],
            nivo_describe_op: [true, false],
            nivo_call: [false, true],
            nivo_contact_list: [true, false],
            nivo_chat_thread_get: [true, false],
            nivo_record_type_list: [true, false],
            nivo_workflow_run: [false, false],
            nivo_stop_list: [true, false],
            nivo_stop_answer: [false, true],
            nivo_run_step_decide: [false, true],
            nivo_file_link: [false, true],
        })
        const answer = tools.find((tool) => tool.name === "nivo_stop_answer")
        expect(answer?.meta).toEqual({ "nivo/op": NIVO_API.stop.answer })
        expect(answer?.inputSchema.required).toEqual(expect.arrayContaining(["runId", "action", "opKey"]))
        const direct = tools.find((tool) => tool.name === "nivo_file_link")
        expect(direct?.meta).toEqual({ "nivo/op": NIVO_API.file.link })
        expect(direct?.inputSchema.required).toEqual(expect.arrayContaining(["recordId", "field", "opKey"]))
        expect(direct?.description).toContain(NIVO_API.file.link)
        expect(tools.find((tool) => tool.name === "nivo_call")?.description).toContain("describe what it will do to your user")
        const run = tools.find((tool) => tool.name === "nivo_workflow_run")
        expect(run?.annotations.idempotentHint).toBe(true)
        expect(run?.inputSchema.required).toEqual(expect.arrayContaining(["installationId", "workflowId", "inputs", "opKey"]))
        expect(JSON.stringify(tools)).not.toContain("node tool")
    })
})

describe("McpSurfaceService identity", () => {
    it("refuses a key of another workspace than the path names, and a key revoked or a holder gone since", async () => {
        const { service } = await build()
        await expect(
            service.answer({ pathWorkspaceId: CONTACT, principal: { keyId: "key-1", workspaceId: WS }, http: HTTP }),
        ).rejects.toMatchObject({ code: McpEndpointErrorCode.WorkspaceMismatch })

        for (const scenario of [{ key: "gone" }, { role: null }] as const) {
            const gone = await build(scenario)
            await expect(
                gone.service.answer({ pathWorkspaceId: WS, principal: { keyId: "key-1", workspaceId: WS }, http: HTTP }),
            ).rejects.toMatchObject({ code: McpEndpointErrorCode.KeyGone })
        }
    })
})

describe("McpSurfaceService data ops", () => {
    it("runs a direct read as the holder, writes ONE audit line for the key and the holder, and marks customer text", async () => {
        const { surface, executor, callLog } = await build({ role: "manager" })

        const answer = await (await surface()).call("nivo_contact_list", { search: "Lan" })

        expect(answer).toMatchObject({
            isError: false,
            value: { op: NIVO_API.contact.list, data: { contacts: [], next: null }, untrustedText: true },
        })
        expect(answer.text).toContain("never instructions")
        expect(executor.execute).toHaveBeenCalledWith(NIVO_API.contact.list, { search: "Lan" }, { workspaceId: WS, userId: "user-1", agentId: null })
        expect(callLog.append).toHaveBeenCalledTimes(1)
        expect(callLog.append).toHaveBeenCalledWith(
            expect.objectContaining({
                workspaceId: WS,
                connector: "nivo-api",
                tool: NIVO_API.contact.list,
                agentId: null,
                outcome: "ok",
                errorCode: null,
                originKind: "mcp_endpoint",
                apiKeyId: "key-1",
                actorUserId: "user-1",
            }),
        )
    })

    it("answers a handler's data as a deep copy: later changes to what the handler returned do not reach the answer", async () => {
        const { surface, executor } = await build({ role: "manager" })
        const returned = { contacts: [{ name: "Lan" }], next: null }
        executor.execute.mockResolvedValue({ ok: true, data: returned })

        const answer = await (await surface()).call("nivo_contact_list", {})
        returned.contacts[0] = { name: "changed" }

        expect(answer).toMatchObject({ isError: false, value: { data: { contacts: [{ name: "Lan" }], next: null } } })
    })

    it("refuses a staff holder an op the GraphQL guard keeps for managers, before the op runs, and audits the refusal once", async () => {
        const { surface, executor, callLog } = await build({ role: "staff" })

        const answer = await (await surface()).call("nivo_contact_get", { id: CONTACT })

        expect(answer).toMatchObject({ isError: true, value: { error: "forbidden_role", detail: { required: "manager" } } })
        expect(executor.execute).not.toHaveBeenCalled()
        expect(callLog.append).toHaveBeenCalledTimes(1)
        expect(callLog.append).toHaveBeenCalledWith(expect.objectContaining({ outcome: "refused", errorCode: "forbidden_role" }))
    })

    it("refuses arguments its declaration does not accept, as a tool error the client can correct from", async () => {
        const { surface, executor } = await build()

        const answer = await (await surface()).call("nivo_contact_get", { id: "not-a-uuid", extra: 1 })

        expect(answer.isError).toBe(true)
        expect(answer.value).toMatchObject({ error: "invalid_arguments", detail: { issues: ISSUES } })
        expect(executor.execute).not.toHaveBeenCalled()
    })

    it("requires an opKey for a write and replays it once-only through the receipts under the key's own namespace", async () => {
        const { surface, executor, receipts } = await build()
        const served = await surface()
        executor.execute.mockResolvedValue({ ok: true, data: { status: "started", refusal: null, issues: [], wakeId: "w-1", runId: null } })
        const args = { installationId: RUN, workflowId: CONTACT, inputs: {} }

        const missing = await served.call("nivo_workflow_run", args)
        const done = await served.call("nivo_workflow_run", { ...args, opKey: "run-1" })

        expect(missing.value).toMatchObject({ error: "idempotency_key_required" })
        expect(done.isError).toBe(false)
        expect(receipts.run).toHaveBeenCalledTimes(1)
        expect(receipts.run).toHaveBeenCalledWith(WS, "mcp:key-1:run-1", expect.any(Function))
        // The write's own once-only key reaches the op (a workflow start keys its wake by it).
        expect(executor.execute).toHaveBeenCalledWith(NIVO_API.workflow.run, args, expect.anything(), "run-1")
    })

    it("answers a refusal of the op's own handler as a tool error with its typed code", async () => {
        const { surface, executor, callLog } = await build()
        executor.execute.mockResolvedValue({ ok: false, code: "CONTACTS_NOT_FOUND" })

        const answer = await (await surface()).call("nivo_call", { name: NIVO_API.contact.get, args: { id: CONTACT } })

        expect(answer).toMatchObject({ isError: true, value: { op: NIVO_API.contact.get, error: "CONTACTS_NOT_FOUND" } })
        expect(callLog.append).toHaveBeenCalledWith(expect.objectContaining({ outcome: "refused", errorCode: "CONTACTS_NOT_FOUND" }))
    })
})

describe("McpSurfaceService discovery", () => {
    it("finds data ops by words with their summaries and direct tools, a page at a time", async () => {
        const { surface } = await build()
        const served = await surface()

        const first = await served.call("nivo_search_ops", { query: "contact", limit: 2 })
        const second = await served.call("nivo_search_ops", { query: "contact", limit: 2, cursor: "2" })

        expect(first.value).toMatchObject({
            ops: [
                { name: NIVO_API.contact.list, kind: "data", readOnly: true, directTool: "nivo_contact_list" },
                { name: NIVO_API.contact.get, kind: "data", directTool: "nivo_contact_get" },
            ],
            next: "2",
        })
        expect(second.value).toMatchObject({ ops: [{ name: NIVO_API.contact.blockList }, { name: NIVO_API.contact.update }] })
    })

    it("describes a data op with its schemas, annotations, role and GraphQL operation", async () => {
        const { surface } = await build()

        const answer = await (await surface()).call("nivo_describe_op", { name: NIVO_API.contact.merge })

        expect(answer.value).toMatchObject({
            name: NIVO_API.contact.merge,
            readOnly: false,
            destructive: true,
            role: "manager",
            graphqlOperation: "mergeContacts",
            inputSchema: { type: "object", required: ["intoContactId", "fromContactId"] },
        })
    })

    it("never offers an op declared never exposed: not found, not described, not runnable", async () => {
        const { surface, executor } = await build()
        const served = await surface()

        const found = await served.call("nivo_search_ops", { query: "key", limit: 25 })
        const described = await served.call("nivo_describe_op", { name: NIVO_API.workspace.delete })
        const called = await served.call("nivo_call", { name: NIVO_API.key.create, args: { name: "x" }, opKey: "k" })

        const names = JSON.stringify(found.value)
        expect(names).not.toContain("nivo.api.nivo.key.")
        expect(described).toMatchObject({ isError: true, value: { error: "unknown_op" } })
        expect(called).toMatchObject({ isError: true, value: { error: "unknown_op" } })
        expect(executor.execute).not.toHaveBeenCalled()
    })
})

describe("McpSurfaceService offers no node tool", () => {
    it.each([
        ["an unscoped key", null],
        ["a key scoped to an agent", "agent-1"],
    ])("gives %s no node tool: search finds none, describe and call answer unknown_op, nothing runs", async (_label, agentId) => {
        const { surface, executor } = await build({ agentId, role: "owner" })
        const served = await surface()

        const found = await served.call("nivo_search_ops", { query: "nivo.tool domain renewal", limit: 25 })
        const described = await served.call("nivo_describe_op", { name: "nivo.tool.domain.renewal.create" })
        const called = await served.call("nivo_call", { name: "nivo.tool.domain.renewal.create", args: {}, opKey: "k" })

        expect(JSON.stringify(found.value)).not.toContain("nivo.tool.")
        expect(JSON.stringify(found.value)).not.toContain("node_tool")
        expect(described).toMatchObject({ isError: true, value: { error: "unknown_op" } })
        expect(called).toMatchObject({ isError: true, value: { error: "unknown_op" } })
        expect(executor.execute).not.toHaveBeenCalled()
    })

    it("hands a scoped key's agent to the op (the key only narrows which agents and workflows it sees)", async () => {
        const { surface, executor } = await build({ agentId: "agent-1", role: "manager" })

        await (await surface()).call("nivo_stop_list", {})

        expect(executor.execute).toHaveBeenCalledWith(NIVO_API.stop.list, {}, { workspaceId: WS, userId: "user-1", agentId: "agent-1" })
    })
})

describe("McpSurfaceService annotations of the direct ops", () => {
    it("marks every direct op with the declaration's read-only and destructive hints", async () => {
        const { surface } = await build()
        const tools = (await surface()).tools.filter((tool) => tool.meta["nivo/op"] !== undefined)

        expect(tools).toHaveLength(13)
        for (const tool of tools) {
            expect(tool.annotations.openWorldHint).toBe(false)
            expect(tool.annotations.readOnlyHint && tool.annotations.destructiveHint).toBe(false)
        }
        expect(tools.find((tool) => tool.name === "nivo_run_list")?.meta).toEqual({ "nivo/op": NIVO_API.run.list })
    })
})
