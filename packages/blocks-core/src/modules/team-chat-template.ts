import { TOOL } from "../vocabulary/tool-ids"

/** The key of the chat-turn workflow inside an agent (`<module>.team-chat` as the thread flag names it); what the router pins. */
export const TEAM_CHAT_WORKFLOW_KEY = "team-chat"

/** The modules whose agent answers the team: every module that declares an agent. */
export const TEAM_CHAT_MODULES: ReadonlyArray<string> = ["accounting", "sales", "chatbot"]

/** The node key of the one step. */
const STEP_KEY = "answer"

/** A trigger input the router always supplies. */
const required = (name: string, type: "string" | "object" | "array"): Readonly<Record<string, unknown>> => ({
    name,
    type,
    required: true,
})

/**
 * The graph of a module's chat turn: one `team.chat` step whose input is the trigger as the team-chat router supplies it, reached only
 * by the router's pin (its one trigger is a workflow call, so no business wake ever lands on it). Its grant is exactly the step's: the
 * truth-graph tools and the team post its answer goes through; no right on a record.
 */
const teamChatGraphOf = (moduleKey: string): Readonly<Record<string, unknown>> => ({
    schema: "nivo/agent-graph@1",
    moduleKey,
    contract: {
        inputs: [
            required("roomId", "string"),
            required("messageId", "string"),
            required("text", "string"),
            required("room", "string"),
            required("intent", "string"),
            required("asker", "object"),
            required("lines", "array"),
            { name: "replyTo", type: "object", required: false },
            required("locale", "string"),
        ],
    },
    triggers: [{ key: "call", source: { kind: "workflow", connectionId: null } }],
    entry: { openTo: "any" },
    trigger: { kind: "tag", sources: ["agent"], burst: { agent: { window: "0s" } } },
    grant: {
        rights: [],
        tools: [TOOL.brainSearch, TOOL.brainFactGet, TOOL.brainFactRelated, TOOL.brainChangePropose],
        effects: [TOOL.teamMessagePost],
    },
    nodes: [
        {
            key: STEP_KEY,
            kind: "output",
            step: "team.chat",
            params: Object.fromEntries(
                ["roomId", "messageId", "text", "room", "intent", "asker", "lines", "replyTo", "locale"].map((name) => [
                    name,
                    { $ref: `trigger.${name}` },
                ]),
            ),
        },
    ],
})

/**
 * The raw template of a module's chat turn ("Trả lời đội"): seeded ACTIVE (`seedActive`), so every agent of the module can answer the
 * team from the first day; never primary (a business wake never routes to it). Parsed like every JSON template.
 */
export const teamChatTemplateOf = (moduleKey: string): Readonly<Record<string, unknown>> => ({
    id: `${moduleKey}.${TEAM_CHAT_WORKFLOW_KEY}`,
    moduleKey,
    primary: false,
    seedActive: true,
    name: { vi: "Trả lời đội", en: "Answer the team" },
    summary: {
        vi: "Trả lời người trong tiệm trong chat riêng hoặc khi được gọi tên trong phòng chung; đề nghị sửa Second Brain khi chủ tiệm đổi một quy định",
        en: "Answers the shop's people in the private chat or when called by name in a shared room; proposes a Second Brain change when the owner changes a rule",
    },
    requires: [],
    shops: 0,
    versions: [
        {
            version: 1,
            publishedAt: "2026-11-11T12:00:00.000Z",
            changes: [
                {
                    vi: "Lượt chat với đội: một bước Trả lời đội, chỉ đọc sự thật của tiệm và đề nghị sửa Second Brain; không đụng tới khách hay tiền",
                    en: "The team chat turn: one Answer the team step that only reads the shop's truths and proposes Second Brain changes; it never touches a customer or money",
                },
            ],
            graph: teamChatGraphOf(moduleKey),
        },
    ],
})
