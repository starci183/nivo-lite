import { Test } from "@nestjs/testing"
import { FakeClock, fakeIds, mock } from "@starci/jest-preset"
import { TOOL } from "@nivo-lite/agent-sdk/names"
import { CustomerMessageNativeService } from "@modules/domain/channels/customer-message-native.service"
import { LOCKED_ARGUMENTS, LOCKED_CONTEXT_TOOLS } from "@modules/domain/context-sources"
import { CustomerMessagesService } from "@modules/domain/customer-routes"
import { GraphNodeRunTokensService, type NodeTurn } from "@modules/domain/graph-nodes"
import { LEAD_KIND } from "@modules/domain/graph-nodes/graph-node-run-tokens.service"
import { WorkspaceMembersReadService } from "@modules/domain/workspace-members"
import { SERVED_READS } from "@tests/fixtures/builders/served-tools.builder"
import { CLOCK } from "@modules/platform/clock"
import { IDS } from "@modules/platform/ids"
import { LOGGER, type Logger } from "@modules/platform/logging"
import { NodeToolDoorService } from "./node-tool-door.service"
import { ToolRegistryService } from "./tool-registry.service"
import type { ManifestTool, ToolCallResult } from "./tools.contracts"

// RULING R51 ITEM 1 on the REAL shapes: the REAL run token (what the host mints for a run about a person), the REAL door's fill of a
// locked context read, and the REAL argument schema each locked read is SERVED with (the engine's own families and every installed
// package's declarations), validated exactly as the gateway validates it (`ToolRegistryService.call`: `argumentSchema.safeParse` before the
// executor; a refusal is `invalid_arguments`). On dev 2026-11-14 the thread read was refused this way on EVERY call: the door filled the
// run's `contactId` into `nivo.tool.conversation.message.list`, whose strict schema took only `conversationId`, so the chatbot never
// answered. Why no test caught it: the door's spec mocks the gateway (any args are accepted) and fills the thread read for a run with NO
// subject at all (`conversationId: null`, no contact, no lead), the executor's spec calls it with `{}`, and every world replaces the whole
// door with a read double that never validates arguments (`tests/engine-threads/thread-world-reads.ts`).

const NOW = Date.parse("2026-11-14T03:00:00.000Z")
const ROUTE = "route-1"
const CONTACT = "contact-1"
const LEAD = "lead-1"

/** Every read the app SERVES with the argument schema it is validated with: the engine's families and the installed packages' declarations. */
const SERVED: ReadonlyMap<string, ManifestTool> = SERVED_READS

/** What the nodes themselves pass to each locked read (the packages' calls): never an id. */
const NODE_ARGS: Readonly<Record<string, Readonly<Record<string, unknown>>>> = {
    [TOOL.conversationMessageList]: { limit: 20, since: "2026-11-14T02:00:00.000Z" },
    [TOOL.contactGet]: {},
    [TOOL.leadOrderList]: { limit: 3 },
    [TOOL.leadCareGet]: {},
}

/** A front desk run about a person (route + contact, no lead): the run that was refused on dev. */
const FRONT_DESK_TURN: NodeTurn = { turnId: "run-1", workspaceId: "ws-1", agentId: "agent-front", subject: null, conversationId: ROUTE, contactId: CONTACT, locale: "vi" }

/** A sale about a person and its lead (route + contact + lead). */
const SALE_TURN: NodeTurn = {
    turnId: "run-2",
    workspaceId: "ws-1",
    agentId: "agent-sales",
    subject: { kind: LEAD_KIND, id: LEAD },
    conversationId: ROUTE,
    contactId: CONTACT,
    locale: "vi",
}

/** The turns a run token is minted for. */
const TURNS: ReadonlyArray<readonly [string, NodeTurn]> = [
    ["a front desk run about a person (route + contact)", FRONT_DESK_TURN],
    ["a sale about a person and its lead (route + contact + lead)", SALE_TURN],
]

/** The real door over the real run tokens; the gateway validates each call with the SERVED schema, as the real one does, and keeps what it got. */
const build = async () => {
    const gateway = mock<ToolRegistryService>()
    const forwarded: Array<{ readonly tool: string; readonly args: Readonly<Record<string, unknown>> }> = []
    gateway.call.mockImplementation((_caller, tool, args): Promise<ToolCallResult> => {
        forwarded.push({ tool, args })
        const valid = SERVED.get(tool)?.argumentSchema?.safeParse(args).success === true
        return Promise.resolve(valid ? { ok: true, value: {} } : { ok: false, code: "invalid_arguments", detail: "Invalid tool arguments" })
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            NodeToolDoorService,
            GraphNodeRunTokensService,
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: IDS, useValue: fakeIds("e0f20000") },
            { provide: ToolRegistryService, useValue: gateway },
            { provide: WorkspaceMembersReadService, useValue: mock<WorkspaceMembersReadService>() },
            { provide: LOGGER, useValue: mock<Logger>() },
        ],
    }).compile()
    return { door: moduleRef.get(NodeToolDoorService), tokens: moduleRef.get(GraphNodeRunTokensService), forwarded }
}

describe("every locked context read accepts what the door fills into it (ruling R51 item 1)", () => {
    it("the locked reads are exactly the four the door locks, and each one is served with an argument schema", () => {
        expect([...LOCKED_CONTEXT_TOOLS]).toEqual(
            [TOOL.contactGet, TOOL.conversationMessageList, TOOL.leadCareGet, TOOL.leadOrderList].toSorted((a, b) => a.localeCompare(b)),
        )
        for (const tool of LOCKED_CONTEXT_TOOLS) expect(SERVED.get(tool)?.argumentSchema).toBeDefined()
    })

    it.each(TURNS)("%s: the door fills the run's subject and every served schema takes the call", async (_name, turn) => {
        const { door, tokens, forwarded } = await build()
        const token = tokens.mint(turn)

        for (const tool of LOCKED_CONTEXT_TOOLS) {
            await expect(door.call({ token, tool, args: NODE_ARGS[tool] ?? {}, key: `k-${tool}`, approval: null })).resolves.toEqual({})
        }

        // What reached each read: the node's own arguments and every subject member the token carries, filled by the door.
        const own = { conversationId: ROUTE, contactId: CONTACT, ...(turn.subject === null ? {} : { leadId: LEAD }) }
        expect(forwarded.map((one) => one.tool)).toEqual([...LOCKED_CONTEXT_TOOLS])
        for (const one of forwarded) expect(one.args).toEqual({ ...NODE_ARGS[one.tool], ...own })
    })

    it("every served locked read declares every member the door may fill (none is left to chance by a run that carries it)", () => {
        const full = Object.fromEntries(LOCKED_ARGUMENTS.map((name) => [name, `${name}-1`]))
        for (const tool of LOCKED_CONTEXT_TOOLS) expect([tool, SERVED.get(tool)?.argumentSchema?.safeParse(full).success]).toEqual([tool, true])
    })

    it("the thread read's REAL executor answers the call as the door filled it: the run's route, read once", async () => {
        const { door, tokens, forwarded } = await build()
        await door.call({ token: tokens.mint(SALE_TURN), tool: TOOL.conversationMessageList, args: NODE_ARGS[TOOL.conversationMessageList] ?? {}, key: "k", approval: null })
        const lines = mock<CustomerMessagesService>()
        lines.threadOf.mockResolvedValue({ rows: [], next: null })
        const executor = new CustomerMessageNativeService(lines, new FakeClock(NOW))

        await expect(executor.invoke("ws-1", "list", forwarded[0]?.args ?? {}, { agentId: "agent-sales", conversationId: ROUTE })).resolves.toMatchObject({ facts: [] })
        expect(lines.threadOf).toHaveBeenCalledWith("ws-1", ROUTE, { limit: 20, told: "delivered", since: "2026-11-14T02:00:00.000Z" })
    })

    it("the advertised input of a locked read never lists an id the door fills (the model is never invited to name one)", () => {
        for (const tool of LOCKED_CONTEXT_TOOLS) {
            const advertised = JSON.stringify(SERVED.get(tool)?.inputSchema ?? {})
            for (const name of LOCKED_ARGUMENTS) expect([tool, advertised.includes(`"${name}"`)]).toEqual([tool, false])
        }
    })
})
