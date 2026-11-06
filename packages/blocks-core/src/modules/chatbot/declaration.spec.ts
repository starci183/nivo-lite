import { seedSpecProblems } from "@nivo-lite/agent-sdk/module"
import { specProblems } from "@nivo-lite/agent-sdk/spec"
import type { SpecDocument } from "@nivo-lite/agent-sdk/spec"
import { coreBlocks } from "../../blocks/core-blocks"
import { CHATBOT_MESSAGES } from "./chatbot-messages"
import { chatbotCopyKeys } from "./copy"
import { CHATBOT_MODULE_KEY, CHATBOT_PERMISSIONS, chatbotModule } from "./declaration"

/** Every `{ "key": ... }` text a value holds, at any depth. */
const keysIn = (value: unknown): ReadonlyArray<string> => {
    if (Array.isArray(value)) return value.flatMap(keysIn)
    if (typeof value !== "object" || value === null) return []
    return Object.entries(value).flatMap(([name, member]) =>
        name === "key" && typeof member === "string" ? [member] : keysIn(member),
    )
}

describe("the Chatbot module declaration", () => {
    it("declares the inbox reads and the person actions under the module key", () => {
        expect(chatbotModule.key).toBe(CHATBOT_MODULE_KEY)
        expect(chatbotModule.reads.map((read) => read.id)).toEqual([
            "chatbot.threads",
            "chatbot.thread-counts",
            "chatbot.channel-counts",
            "chatbot.thread",
            "chatbot.messages",
            "chatbot.figures",
            "chatbot.decisions",
            "chatbot.proposals",
            "chatbot.settings",
        ])
        expect(chatbotModule.actions.map((action) => action.id)).toEqual([
            "chatbot.reply",
            "chatbot.handoff",
            "chatbot.release",
            "chatbot.decide",
            "chatbot.approve-and-send",
            "chatbot.reject-proposal",
            "chatbot.save-settings",
        ])
    })

    it("has no close action: closing a conversation is dropped", () => {
        expect(chatbotModule.actions.some((action) => action.id.endsWith("close"))).toBe(false)
    })

    it("gates every read on viewing, every action on replying and the rules on managing, all declared", () => {
        expect(CHATBOT_PERMISSIONS).toEqual(["chatbot.view", "chatbot.reply", "chatbot.manage"])
        expect(new Set(chatbotModule.reads.map((read) => read.permission))).toEqual(new Set(["chatbot.view"]))
        expect(new Set(chatbotModule.actions.map((action) => action.permission))).toEqual(
            new Set(["chatbot.reply", "chatbot.manage"]),
        )
    })

    it("runs every read and action in the package, so the door and a graph node run the same code", () => {
        expect(chatbotModule.reads.every((read) => read.execute !== undefined)).toBe(true)
        expect(chatbotModule.actions.every((action) => action.execute !== undefined)).toBe(true)
    })

    it("makes every write transactional and calls no door or model inside it: the ports are data only", () => {
        expect(chatbotModule.actions.every((action) => action.transactional === true)).toBe(true)
        const portIds = chatbotModule.actions.flatMap((action) =>
            Object.values(action.ports ?? {}).map((port) => port.id),
        )
        expect(portIds).not.toContain("chatbot.door")
    })
})

describe("the Chatbot seed spec", () => {
    it("draws with the core blocks and the module own reads, actions and permissions", () => {
        expect(seedSpecProblems(chatbotModule, coreBlocks)).toEqual([])
    })

    it("holds the customers, the unanswered, the inbox and the rules views and names the module of the declaration", () => {
        const [spec] = chatbotModule.specs
        expect(spec?.module).toBe(CHATBOT_MODULE_KEY)
        expect(spec?.views.map((view) => view.id)).toEqual(["customers", "unanswered", "inbox", "rules"])
    })

    it("places the core blocks and the Chatbot's own: the inbox with the approval card inside it", () => {
        const [spec] = chatbotModule.specs
        const blocks = (JSON.stringify(spec).match(/"block":"([^"]+)"/g) ?? []).map((block) =>
            block.slice('"block":"'.length, -1),
        )
        expect(blocks.every((block) => block.startsWith("core.") || block.startsWith("chatbot."))).toBe(true)
        expect(blocks).toEqual(expect.arrayContaining(["chatbot.inbox", "chatbot.approval-card"]))
    })

    it("words every text with a key the catalogue holds in both languages", () => {
        const keys = keysIn(chatbotModule.specs)
        expect(keys.length).toBeGreaterThan(20)
        for (const locale of ["vi", "en"] as const) {
            const known = new Set(Object.keys(CHATBOT_MESSAGES[locale]))
            expect(keys.filter((key) => !known.has(key))).toEqual([])
        }
    })

    it("words the action labels and refusals with catalogue keys too", () => {
        const known = new Set(chatbotCopyKeys("en"))
        const labels = chatbotModule.actions.flatMap((action) => keysIn(action.label))
        expect(labels).toHaveLength(7)
        expect(labels.filter((key) => !known.has(key))).toEqual([])
    })

    it("is refused when it binds a read the module does not have", () => {
        const broken: SpecDocument = {
            schema: "nivo/workbench-spec@1",
            module: "chatbot",
            views: [
                {
                    id: "v",
                    label: { key: "tab_inbox" },
                    root: {
                        id: "r",
                        block: "core.waiting",
                        props: { label: { key: "tab_inbox" } },
                        bind: { region: { read: "chatbot.nothing" } },
                    },
                },
            ],
        }
        expect(
            specProblems(broken, coreBlocks, {
                reads: chatbotModule.reads,
                actions: chatbotModule.actions,
                permissions: chatbotModule.permissions,
            }).map((problem) => problem.code),
        ).toContain("SPEC_BINDING_UNKNOWN")
    })
})
