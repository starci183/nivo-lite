import { contactBlockProblems, seedSpecProblems } from "@nivo-lite/agent-sdk/module"
import { specProblems } from "@nivo-lite/agent-sdk/spec"
import type { SpecDocument } from "@nivo-lite/agent-sdk/spec"
import { coreBlocks } from "../../shared/blocks/core-blocks"
import { conversationEntity } from "./entities/conversation.entity"
import { platformModule } from "../../shared/platform/declaration"
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
            "blocks-core.chatbot.api.chat.list",
            "blocks-core.chatbot.api.chat.of-contact",
            "blocks-core.chatbot.api.chat.status-counts",
            "blocks-core.chatbot.api.chat.channel-counts",
            "blocks-core.chatbot.api.chat.get",
            "blocks-core.chatbot.api.message.list",
            "blocks-core.chatbot.api.chat.figures",
            "blocks-core.chatbot.api.chat.waiting",
            "blocks-core.chatbot.api.settings.get",
        ])
        expect(chatbotModule.actions.map((action) => action.id)).toEqual([
            "blocks-core.chatbot.chat-reply",
            "blocks-core.chatbot.chat-handoff",
            "blocks-core.chatbot.chat-release",
            "blocks-core.chatbot.chat-decide",
            "blocks-core.chatbot.settings-save",
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
        expect(portIds).not.toContain("engine.door")
    })
})

describe("the Chatbot seed spec", () => {
    it("draws with the core blocks and the module own reads, actions and permissions", () => {
        expect(seedSpecProblems(chatbotModule, coreBlocks, [platformModule])).toEqual([])
    })

    it("holds the agent's desk, then the customers, the unanswered, the inbox and the rules views, then the desk's data page, and names the module of the declaration", () => {
        const [spec] = chatbotModule.specs
        expect(spec?.module).toBe(CHATBOT_MODULE_KEY)
        expect(spec?.views.map((view) => view.id)).toEqual([
            "desk",
            "customers",
            "unanswered",
            "inbox",
            "rules",
            "data-conversations",
        ])
    })

    // Design change (ruling R23): the draft road is removed, the approval card with it.
    it("places the core blocks and the Chatbot's own: the inbox", () => {
        const [spec] = chatbotModule.specs
        const blocks = (JSON.stringify(spec).match(/"block":"([^"]+)"/g) ?? []).map((block) =>
            block.slice('"block":"'.length, -1),
        )
        expect(blocks.every((block) => block.startsWith("core.") || block.startsWith("chatbot."))).toBe(true)
        expect(blocks).toEqual(expect.arrayContaining(["chatbot.inbox"]))
        expect(blocks).not.toContain("chatbot.approval-card")
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
        expect(labels).toHaveLength(5)
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

describe("the Chatbot block on the contact detail", () => {
    it("mounts the conversations of the person, over the Chatbot's own read that takes a contactId", () => {
        expect(chatbotModule.contactBlocks?.map((block) => block.id)).toEqual(["conversations"])
        expect(chatbotModule.contactBlocks?.map((block) => block.read)).toEqual(["blocks-core.chatbot.api.chat.of-contact"])
    })

    it("is sound: the read reaches a type with a contact field and the record list fits the read", () => {
        expect(contactBlockProblems(chatbotModule, coreBlocks, [conversationEntity])).toEqual([])
    })

    it("words its block with catalogue keys of both languages", () => {
        const keys = keysIn(chatbotModule.contactBlocks)
        expect(keys.length).toBeGreaterThan(5)
        for (const locale of ["vi", "en"] as const) {
            const known = new Set(Object.keys(CHATBOT_MESSAGES[locale]))
            expect(keys.filter((key) => !known.has(key))).toEqual([])
        }
    })
})
