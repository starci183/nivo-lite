import { Test } from "@nestjs/testing"
import { Command, CommandBus, Query, QueryBus } from "@nestjs/cqrs"
import { mock } from "@starci/jest-preset"
import { NIVO_API } from "@nivo-lite/agent-sdk/names"
import { AgentRunsService, type RunView } from "@modules/domain/agent-runs"
import { InstallationRecordsService, type InstallationRecord } from "@modules/domain/module-installations"
import type { ExecuteParams } from "@modules/platform/cqrs"
import { DomainError } from "@modules/platform/errors"
import { NIVO_API_OP_GROUPS } from "./nivo-api.decorators"
import { NivoApiExecutorService } from "./nivo-api-executor.service"
import type { NivoApiOpGroup } from "./nivo-api-ops.contracts"
import { NivoApiOpsService } from "./nivo-api-ops.service"

class ContactsRefusal extends DomainError<string> {}

/** A query of a feature: it holds the params the executor built. */
class FakeQuery extends Query<unknown> {
    constructor(readonly params: ExecuteParams<unknown>) {
        super()
    }
}

/** A command of a feature: it holds the params the executor built. */
class FakeCommand extends Command<unknown> {
    constructor(readonly params: ExecuteParams<unknown>) {
        super()
    }
}

/** The ops the specs run: a read, a write, and one of each narrowing. */
const GROUP: NivoApiOpGroup = {
    handlers: [],
    queries: {
        [NIVO_API.contact.list]: FakeQuery,
        [NIVO_API.chatThread.get]: FakeQuery,
        [NIVO_API.workbench.read]: FakeQuery,
        [NIVO_API.agent.list]: FakeQuery,
        [NIVO_API.agent.deletionImpact]: FakeQuery,
        [NIVO_API.workflow.list]: FakeQuery,
        [NIVO_API.workflow.get]: FakeQuery,
        [NIVO_API.run.list]: FakeQuery,
        [NIVO_API.run.get]: FakeQuery,
        [NIVO_API.stop.list]: FakeQuery,
    },
    commands: {
        [NIVO_API.contact.delete]: FakeCommand,
        [NIVO_API.workbench.action]: FakeCommand,
        [NIVO_API.workflow.run]: FakeCommand,
        [NIVO_API.run.stepDecide]: FakeCommand,
        [NIVO_API.stop.answer]: FakeCommand,
    },
}

const ACTOR = { workspaceId: "ws-1", userId: "user-1", agentId: null }
const HOLDER = { id: "user-1", role: "authenticated" }

/** A key scoped to agent-1 (its installation INST_A), beside agent-2 (installation INST_B) of the same workspace. */
const SCOPED = { workspaceId: "ws-1", userId: "user-1", agentId: "agent-1" }
const INST_A = "11111111-1111-4111-8111-111111111111"
const INST_B = "22222222-2222-4222-8222-222222222222"
const RUN_A = "33333333-3333-4333-8333-333333333333"
const RUN_B = "44444444-4444-4444-8444-444444444444"
const WORKFLOW = "55555555-5555-4555-8555-555555555555"
const IDS = { installationId: INST_A, workflowId: WORKFLOW }

const build = async () => {
    const commandBus = mock<CommandBus>()
    const queryBus = mock<QueryBus>()
    const installations = mock<InstallationRecordsService>()
    installations.find.mockImplementation((_workspaceId: string, id: string) =>
        Promise.resolve(id === INST_A || id === INST_B ? mock<InstallationRecord>({ id, agentId: id === INST_A ? "agent-1" : "agent-2" }) : null),
    )
    const runs = mock<AgentRunsService>()
    runs.runOf.mockImplementation((_workspaceId: string, id: string) =>
        Promise.resolve(id === RUN_A || id === RUN_B ? mock<RunView>({ id, agentId: id === RUN_A ? "agent-1" : "agent-2" }) : null),
    )
    const moduleRef = await Test.createTestingModule({
        providers: [
            NivoApiExecutorService,
            NivoApiOpsService,
            { provide: NIVO_API_OP_GROUPS, useValue: [GROUP] },
            { provide: CommandBus, useValue: commandBus },
            { provide: QueryBus, useValue: queryBus },
            { provide: InstallationRecordsService, useValue: installations },
            { provide: AgentRunsService, useValue: runs },
        ],
    }).compile()
    return { executor: moduleRef.get(NivoApiExecutorService), commandBus, queryBus }
}

describe("NivoApiExecutorService", () => {
    it("runs a read through the query its feature declares, as the holder in the key workspace, and answers what the handler answered", async () => {
        const { executor, queryBus } = await build()
        queryBus.execute.mockResolvedValue({ contacts: [], next: null })

        await expect(executor.execute(NIVO_API.contact.list, { search: "Lan", size: 5 }, ACTOR)).resolves.toEqual({
            ok: true,
            data: { contacts: [], next: null },
        })
        const [query] = queryBus.execute.mock.calls[0] ?? []
        expect(query).toBeInstanceOf(FakeQuery)
        expect(query).toMatchObject({ params: { request: { workspaceId: "ws-1", search: "Lan", size: 5 }, principal: HOLDER } })
    })

    it("runs a write through the command its feature declares, and answers a typed refusal of its handler as its code", async () => {
        const { executor, commandBus } = await build()
        commandBus.execute.mockRejectedValue(new ContactsRefusal({ code: "CONTACTS_RECORDS_BLOCKED" }))

        await expect(executor.execute(NIVO_API.contact.delete, { id: INST_B }, ACTOR, "op-1")).resolves.toEqual({
            ok: false,
            code: "CONTACTS_RECORDS_BLOCKED",
        })
        expect(commandBus.execute.mock.calls[0]?.[0]).toBeInstanceOf(FakeCommand)
    })

    it("rethrows a failure that is no typed refusal (a server fault is no answer)", async () => {
        const { executor, queryBus } = await build()
        queryBus.execute.mockRejectedValue(new Error("db down"))

        await expect(executor.execute(NIVO_API.contact.list, {}, ACTOR)).rejects.toThrow("db down")
    })

    it("refuses arguments the op declared input does not take, before any bus", async () => {
        const { executor, queryBus } = await build()

        await expect(executor.execute(NIVO_API.contact.list, { size: 5000 }, ACTOR)).rejects.toThrow()
        expect(queryBus.execute).not.toHaveBeenCalled()
    })

    it("shapes a /chat thread page as messages and the next cursor, and a workbench read vars as the door JSON payload", async () => {
        const { executor, queryBus } = await build()
        queryBus.execute
            .mockResolvedValueOnce({ nodes: [{ id: "m-1" }], hasNextPage: true, endCursor: "c-2" })
            .mockResolvedValueOnce({ data: '{"rows":[]}' })

        await expect(executor.execute(NIVO_API.chatThread.get, { threadId: WORKFLOW, first: 10 }, ACTOR)).resolves.toEqual({
            ok: true,
            data: { messages: [{ id: "m-1" }], next: "c-2" },
        })
        await expect(
            executor.execute(NIVO_API.workbench.read, { name: "blocks-core.sales.api.order.list", vars: { q: "A12" } }, ACTOR),
        ).resolves.toEqual({ ok: true, data: { data: { rows: [] } } })
        expect(queryBus.execute.mock.calls[1]?.[0]).toMatchObject({ params: { request: { payload: '{"q":"A12"}', locale: "vi" } } })
    })

})

describe("NivoApiExecutorService writes and refusals", () => {
    it("starts a workflow through its command keyed by the call opKey (trimmed), and runs a workbench action as the door JSON payload", async () => {
        const { executor, commandBus } = await build()
        commandBus.execute
            .mockResolvedValueOnce({ status: "started", refusal: null, issues: [], wakeId: "w-1", runId: null })
            .mockResolvedValueOnce({ data: '{"ok":true}' })

        await expect(executor.execute(NIVO_API.workflow.run, { ...IDS, inputs: { contactId: "c-1" } }, ACTOR, " op-7 ")).resolves.toEqual({
            ok: true,
            data: { status: "started", refusal: null, issues: [], wakeId: "w-1", runId: null },
        })
        await expect(
            executor.execute(NIVO_API.workbench.action, { name: "blocks-core.sales.order-save", input: { code: "A12" } }, ACTOR, "op-8"),
        ).resolves.toEqual({ ok: true, data: { result: { ok: true } } })
        expect(commandBus.execute.mock.calls[0]?.[0]).toMatchObject({
            params: { request: { workspaceId: "ws-1", ...IDS, inputs: { contactId: "c-1" }, opKey: "op-7" }, principal: HOLDER },
        })
    })

    it.each([
        [NIVO_API.workflow.run, { ...IDS, inputs: {} }],
        [NIVO_API.stop.answer, { runId: RUN_A, action: "retry" }],
    ])("refuses %s with no opKey before any bus (the once-only key is the write identity)", async (name, args) => {
        const { executor, commandBus } = await build()

        await expect(executor.execute(name, args, ACTOR)).resolves.toEqual({ ok: false, code: "idempotency_key_required" })
        await expect(executor.execute(name, args, ACTOR, "   ")).resolves.toEqual({ ok: false, code: "idempotency_key_required" })
        expect(commandBus.execute).not.toHaveBeenCalled()
    })

    it.each([NIVO_API.workspace.delete, NIVO_API.agent.toolList, NIVO_API.record.typeList])(
        "refuses %s, which no feature declares, without touching a bus",
        async (name) => {
            const { executor, commandBus, queryBus } = await build()

            await expect(executor.execute(name, {}, ACTOR, "op-1")).resolves.toEqual({ ok: false, code: "not_exposed" })
            expect(commandBus.execute).not.toHaveBeenCalled()
            expect(queryBus.execute).not.toHaveBeenCalled()
        },
    )
})

describe("NivoApiExecutorService under an agent-scoped key (it only narrows which agents and workflows the key sees)", () => {
    it.each<[string, Parameters<NivoApiExecutorService["execute"]>[0], Readonly<Record<string, unknown>>]>([
        ["agent.deletionImpact", NIVO_API.agent.deletionImpact, { installationId: INST_B }],
        ["workflow.list", NIVO_API.workflow.list, { installationId: INST_B }],
        ["workflow.get", NIVO_API.workflow.get, { installationId: INST_B, workflowId: WORKFLOW }],
        ["workflow.run", NIVO_API.workflow.run, { installationId: INST_B, workflowId: WORKFLOW, inputs: {} }],
        ["run.list", NIVO_API.run.list, { installationId: INST_B }],
        ["run.get of another agent's installation", NIVO_API.run.get, { installationId: INST_B, runId: RUN_B }],
        ["run.get of another agent's run", NIVO_API.run.get, { installationId: INST_A, runId: RUN_B }],
        ["workflow.get of an unknown installation", NIVO_API.workflow.get, { installationId: WORKFLOW, workflowId: WORKFLOW }],
        ["stop.answer of another agent's run", NIVO_API.stop.answer, { runId: RUN_B, action: "retry" }],
        ["stop.answer of an unknown run", NIVO_API.stop.answer, { runId: WORKFLOW, action: "skip" }],
        ["run.step.decide of another agent's installation", NIVO_API.run.stepDecide, { installationId: INST_B, runId: RUN_B, verdict: "reject" }],
        ["run.step.decide of another agent's run", NIVO_API.run.stepDecide, { installationId: INST_A, runId: RUN_B, verdict: "approve" }],
    ])("answers %s not_found and sends nothing", async (_label, name, args) => {
        const { executor, commandBus, queryBus } = await build()

        await expect(executor.execute(name, args, SCOPED, "op-1")).resolves.toEqual({ ok: false, code: "not_found" })
        expect(commandBus.execute).not.toHaveBeenCalled()
        expect(queryBus.execute).not.toHaveBeenCalled()
    })

    it("answers its own agent's stop, workflow list, workflow start and run read as the holder would", async () => {
        const { executor, commandBus, queryBus } = await build()
        queryBus.execute.mockResolvedValue([])
        commandBus.execute.mockResolvedValue({ outcome: "admitted", stepKey: "match" })

        await expect(executor.execute(NIVO_API.stop.answer, { runId: RUN_A, action: "retry" }, SCOPED, "op-5")).resolves.toEqual({
            ok: true,
            data: { outcome: "admitted", stepKey: "match" },
        })
        await expect(executor.execute(NIVO_API.workflow.list, { installationId: INST_A }, SCOPED)).resolves.toMatchObject({ ok: true })
        await expect(executor.execute(NIVO_API.run.get, { installationId: INST_A, runId: RUN_A }, SCOPED)).resolves.toMatchObject({ ok: true })
        expect(commandBus.execute).toHaveBeenCalledTimes(1)
        expect(queryBus.execute).toHaveBeenCalledTimes(2)
    })

    it("lists only its own agent among the installed agents, and only its own agent's open stops (no workspace total)", async () => {
        const { executor, queryBus } = await build()
        queryBus.execute
            .mockResolvedValueOnce([
                { id: INST_A, agentId: "agent-1", name: "Sales A" },
                { id: INST_B, agentId: "agent-2", name: "Sales B" },
            ])
            .mockResolvedValueOnce({
                stops: [
                    { stopId: "s-1", agentId: "agent-2" },
                    { stopId: "s-2", agentId: "agent-1" },
                ],
                total: 2,
                next: "2",
            })

        await expect(executor.execute(NIVO_API.agent.list, {}, SCOPED)).resolves.toEqual({
            ok: true,
            data: { agents: [{ id: INST_A, agentId: "agent-1", name: "Sales A" }] },
        })
        await expect(executor.execute(NIVO_API.stop.list, {}, SCOPED)).resolves.toEqual({
            ok: true,
            data: { stops: [{ stopId: "s-2", agentId: "agent-1" }], next: "2" },
        })
    })

    it("leaves an unscoped key every agent its holder's role allows, and the data ops unchanged by a scope", async () => {
        const { executor, queryBus } = await build()
        queryBus.execute.mockResolvedValue([])

        await expect(executor.execute(NIVO_API.run.list, { installationId: INST_B }, ACTOR)).resolves.toMatchObject({ ok: true })
        await expect(executor.execute(NIVO_API.contact.list, {}, SCOPED)).resolves.toMatchObject({ ok: true })
        expect(queryBus.execute).toHaveBeenCalledTimes(2)
    })
})
