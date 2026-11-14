import { TOOL } from "../../../vocabulary/tool-ids"
import { deskFlowsOf, deskQueueOf, deskRowKeyOf, type DeskFlowsView } from "../agent-desk"
import type { AgentReachView, AgentTodayView, WaitingOnPersonFacts } from "../platform.types"
import type { DecisionQueueView } from "../../../views/views.types"

/*
 * The prototype answers of the agent's work desk, one per state a block draws: ready, empty, and the uncounted case (a dash, never 0).
 * The flows are a real installed template's graph turned into the canvas's own cards, never a drawing written here.
 */

/** The installation the desk fixtures read. */
export const DESK_INSTALLATION = "0b6f7c1e-3a53-4a3f-9d52-2d7e8b5f1c11"

/** The members of the router's call the chat turn reads, bound one to one from the trigger. */
const TURN_MEMBERS: ReadonlyArray<string> = ["roomId", "messageId", "text", "room", "intent", "asker", "lines", "replyTo", "locale"]

/** The contract type of one turn member: the asker and the reply target are objects, the lines a list, the rest text. */
const memberTypeOf = (name: string): "object" | "array" | "string" => {
    if (name === "asker" || name === "replyTo") return "object"
    return name === "lines" ? "array" : "string"
}

/**
 * The graph of the Sales chat turn as an `nivo/agent-graph@1` spec (the shape the port hands over): its answer step, `team.chat`, read
 * from the router's call, with the team post in its grant (the truth reads are the default of every step).
 */
const teamChatGraphJson = (): string =>
    JSON.stringify({
        schema: "nivo/agent-graph@1",
        moduleKey: "sales",
        contract: {
            inputs: TURN_MEMBERS.map((name) => ({
                name,
                type: memberTypeOf(name),
                required: name !== "replyTo",
            })),
        },
        triggers: [{ key: "call", source: { kind: "workflow", connectionId: null } }],
        entry: { openTo: "any" },
        // No `burst` (R43 / D: the trigger burst envelope is deleted and the graph schema refuses it): with it the fixture parsed to no graph.
        trigger: { kind: "tag", sources: ["agent"] },
        grant: {
            tools: [],
            effects: [TOOL.teamMessagePost],
        },
        nodes: [
            {
                key: "answer",
                kind: "output",
                step: "team.chat",
                params: Object.fromEntries(TURN_MEMBERS.map((name) => [name, { $ref: `trigger.${name}` }])),
            },
        ],
    })

/** One active workflow, the agent's primary. */
export const DESK_FLOWS_VIEW: DeskFlowsView = deskFlowsOf(
    { flows: [{ key: "team-chat", name: "Tr\u1ea3 l\u1eddi \u0111\u1ed9i", isPrimary: true, graphJson: teamChatGraphJson() }] },
    "vi",
)

/** No workflow is active. */
export const DESK_FLOWS_NONE: DeskFlowsView = { workflows: 0, steps: 0, flows: [] }

/** One approval and one question that waits on its /chat card. */
const WAITING: WaitingOnPersonFacts = {
    count: 2,
    rows: [
        {
            id: "3f2a1b4c-5d6e-4f70-8a91-b2c3d4e5f601",
            runId: "run-7",
            title: "\u0110\u1ed5i s\u1ed1 \u0111i\u1ec7n tho\u1ea1i c\u1ee7a C\u00f4ng ty Minh An",
            askedBy: "Anh T\u00fa",
            askedAt: "2026-11-12T02:12:00.000Z",
            line: "CRM \u00b7 C\u1eadp nh\u1eadt li\u00ean h\u1ec7 \u00b7 0903 \u2022\u2022\u2022 221 \u2192 0938 \u2022\u2022\u2022 407",
            commands: ["decline", "approve"],
        },
        {
            id: "3f2a1b4c-5d6e-4f70-8a91-b2c3d4e5f602",
            runId: "run-8",
            title: "Kh\u00e1ch h\u1ecfi gi\u00e1 gia h\u1ea1n t\u00ean mi\u1ec1n .vn",
            askedBy: null,
            askedAt: "2026-11-12T01:40:00.000Z",
            line: "Ch\u01b0a c\u00f3 b\u1ea3ng gi\u00e1 cho t\u00ean mi\u1ec1n .vn",
            commands: [],
        },
    ],
}

/** The queue of the two rows, as the read lays them out. */
export const DESK_WAITING_VIEW: DecisionQueueView = deskQueueOf(DESK_INSTALLATION, WAITING, {
    locale: "vi",
    timeZone: "Asia/Ho_Chi_Minh",
    now: new Date("2026-11-12T03:00:00.000Z"),
})

/** Nothing waits on a person. */
export const DESK_WAITING_NONE: DecisionQueueView = deskQueueOf(DESK_INSTALLATION, { count: 0, rows: [] }, {
    locale: "vi",
    timeZone: "Asia/Ho_Chi_Minh",
    now: new Date("2026-11-12T03:00:00.000Z"),
})

/** The key of the approval row, which `platform.approval-decide` takes. */
export const DESK_APPROVAL_KEY: string = deskRowKeyOf(DESK_INSTALLATION, "3f2a1b4c-5d6e-4f70-8a91-b2c3d4e5f601")

/** Three approvals, handed over newest first as the port answers: the queue lists the oldest first. */
const THREE: WaitingOnPersonFacts = {
    count: 3,
    rows: [
        {
            id: "3f2a1b4c-5d6e-4f70-8a91-b2c3d4e5f613",
            runId: "run-13",
            title: "Ghi email m\u1edbi c\u1ee7a anh Phong",
            askedBy: "Anh T\u00fa",
            askedAt: "2026-11-12T03:05:00.000Z",
            line: "CRM \u00b7 C\u1eadp nh\u1eadt li\u00ean h\u1ec7 \u00b7 phong@example.vn",
            commands: ["decline", "approve"],
        },
        {
            id: "3f2a1b4c-5d6e-4f70-8a91-b2c3d4e5f611",
            runId: "run-11",
            title: "\u0110\u1ed5i s\u1ed1 \u0111i\u1ec7n tho\u1ea1i c\u1ee7a C\u00f4ng ty Minh An",
            askedBy: "Anh T\u00fa",
            askedAt: "2026-11-12T02:12:00.000Z",
            line: "CRM \u00b7 C\u1eadp nh\u1eadt li\u00ean h\u1ec7 \u00b7 0903 \u2022\u2022\u2022 221 \u2192 0938 \u2022\u2022\u2022 407",
            commands: ["decline", "approve"],
        },
        {
            id: "3f2a1b4c-5d6e-4f70-8a91-b2c3d4e5f612",
            runId: "run-12",
            title: "\u0110\u1ed5i ng\u01b0\u1eddi li\u00ean h\u1ec7 c\u1ee7a H\u1ea3i \u0110\u0103ng",
            askedBy: "Ch\u1ecb Lan",
            askedAt: "2026-11-12T02:40:00.000Z",
            line: "CRM \u00b7 C\u1eadp nh\u1eadt li\u00ean h\u1ec7 \u00b7 H\u1ea3i \u0110\u0103ng",
            commands: ["decline", "approve"],
        },
    ],
}

/** Three approvals waiting: only the oldest one's "approve" is the page's primary (the block's rule). */
export const DESK_WAITING_THREE: DecisionQueueView = deskQueueOf(DESK_INSTALLATION, THREE, {
    locale: "vi",
    timeZone: "Asia/Ho_Chi_Minh",
    now: new Date("2026-11-12T03:30:00.000Z"),
})

/** Today: seven answered, records counted. */
export const DESK_TODAY_VIEW: AgentTodayView = {
    day: "2026-11-12",
    answered: 7,
    recordsRead: 41,
    recordsChanged: 1,
    uncounted: 0,
}

/** Today with calls whose adapters stated no count: the records draw a dash. */
export const DESK_TODAY_UNCOUNTED: AgentTodayView = {
    day: "2026-11-12",
    answered: 3,
    recordsRead: null,
    recordsChanged: null,
    uncounted: 4,
}

/** One account, and operations in each mode. */
export const DESK_REACH_VIEW: AgentReachView = {
    accounts: [{ connectionId: "conn-1", name: "CRM NIVO Web", providerName: "API theo Swagger", state: "connected" }],
    auto: ["\u0110\u1ecdc kh\u00e1ch", "\u0110\u1ecdc d\u1ecbch v\u1ee5", "\u0110\u1ecdc ho\u00e1 \u0111\u01a1n"],
    ask: ["C\u1eadp nh\u1eadt li\u00ean h\u1ec7 c\u1ee7a kh\u00e1ch"],
    none: ["Nh\u1eafc gia h\u1ea1n", "M\u1edf phi\u1ebfu"],
}

/** The agent is attached to nothing. */
export const DESK_REACH_NONE: AgentReachView = { accounts: [], auto: [], ask: [], none: [] }
