import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { DeepseekClient } from "./deepseek.client"
import type { DeepseekScope } from "./deepseek.contracts"
import { DEEPSEEK_OPTIONS, DEEPSEEK_TEXT_GENERATOR } from "./deepseek.decorators"
import type { TextGenerator } from "./deepseek.port"
import { DeepseekErrorCode } from "./errors/deepseek.error"

const scope: DeepseekScope = { workspaceId: "ws-1", locale: "vi" }
const lead = { contact_name: "Lan", company: "ACME", channel: "telegram", need: "A quote" }
const agent = { name: "Mai", handle: "mai", role: "Chatbot", instructions: "Be kind" }

const build = async (jsonRetries = 1) => {
    const generator = mock<TextGenerator>()
    const logger = mock<Logger>()
    const catalog = mock<MessageCatalog>({ get: jest.fn((key: string) => `[${key}]`) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            DeepseekClient,
            { provide: DEEPSEEK_OPTIONS, useValue: { jsonRetries } },
            { provide: DEEPSEEK_TEXT_GENERATOR, useValue: generator },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { client: moduleRef.get(DeepseekClient), generator, logger, catalog }
}

describe("DeepseekClient", () => {
    describe("text prompts", () => {
        it("summarises a context for the sales module in the reader's language", async () => {
            const { client, generator, catalog } = await build()
            generator.generate.mockResolvedValue("- who")

            await expect(client.summarizeContext(scope, lead, ["said hi"])).resolves.toBe("- who")

            const request = generator.generate.mock.calls[0]?.[0]
            expect(request).toMatchObject({
                workspaceId: "ws-1",
                purpose: "sales:engine",
                json: false,
                kind: "engine",
                module: "sales",
            })
            expect(request?.messages[0]?.content).toContain("[prompts.urgencyLabels]")
            expect(request?.messages[0]?.content).toContain("Write in Vietnamese")
            expect(request?.messages[1]?.content).toContain("said hi")
            expect(catalog.get).toHaveBeenCalledWith("prompts.urgencyLabels", {}, "vi")
        })

        it("marks an empty history", async () => {
            const { client, generator } = await build()
            generator.generate.mockResolvedValue("x")

            await client.summarizeContext({ ...scope, locale: "en" }, lead, [])

            const request = generator.generate.mock.calls[0]?.[0]
            expect(request?.messages[1]?.content).toContain("(none)")
            expect(request?.messages[0]?.content).toContain("Write in English")
        })

        it("lets the scope override the usage kind and module", async () => {
            const { client, generator } = await build()
            generator.generate.mockResolvedValue("x")

            await client.draftFollowUp({ ...scope, kind: "followup", module: "crm" }, lead, "ctx", "call", agent, "")

            expect(generator.generate.mock.calls[0]?.[0]).toMatchObject({
                purpose: "sales:engine",
                kind: "followup",
                module: "crm",
            })
        })

        it("drafts a follow-up with or without an agent persona", async () => {
            const { client, generator } = await build()
            generator.generate.mockResolvedValue("hello")

            await client.draftFollowUp(scope, lead, "ctx", "call", agent, " BRIEF")
            await client.draftFollowUp(scope, lead, "ctx", "call", null, "")

            const withAgent = generator.generate.mock.calls[0]?.[0].messages[0]?.content
            const without = generator.generate.mock.calls[1]?.[0].messages[0]?.content
            expect(withAgent).toContain("You are Mai (Chatbot). Instructions: Be kind BRIEF")
            expect(without).not.toContain("You are Mai")
        })

        it("lets an agent reply in the team chat as the owner module", async () => {
            const { client, generator } = await build()
            generator.generate.mockResolvedValue("ok")

            await client.agentReply(scope, agent, ["a", "b"], "state", "BRIEF")
            await client.agentReply(scope, agent, ["a"], "state", "")

            const request = generator.generate.mock.calls[0]?.[0]
            expect(request).toMatchObject({ purpose: "office:owner_chat", kind: "owner_chat", module: "office" })
            expect(request?.messages[0]?.content).toContain("Workspace state:\nstate")
            expect(request?.messages[1]?.content).toBe("a\nb")
        })

        it("tests an agent with the chat so far", async () => {
            const { client, generator } = await build()
            generator.generate.mockResolvedValue("ok")

            await client.testChat(scope, agent, [{ role: "user", body: "Hi" }], "BRIEF")
            await client.testChat(
                scope,
                agent,
                [
                    { role: "user", body: "Hi" },
                    { role: "agent", body: "Hello" },
                ],
                "",
            )

            const messages = generator.generate.mock.calls[1]?.[0].messages
            expect(messages?.map((message) => message.role)).toEqual(["system", "user", "assistant"])
            expect(messages?.[0]?.content).toContain("The business owner is testing you")
        })

        it("drafts a care message with the Vietnamese phrases from the catalog", async () => {
            const { client, generator } = await build()
            generator.generate.mockResolvedValue("thanks")

            await client.draftCare(scope, lead, "Combo - 1.000.000", "BRIEF")

            const request = generator.generate.mock.calls[0]?.[0]
            expect(request?.messages[0]?.content).toContain("[prompts.careExample]")
            expect(request?.messages[0]?.content).toContain("[prompts.careAddress]")
            expect(request?.messages[1]?.content).toContain("Payment: Combo - 1.000.000")
        })
    })

    describe("json prompts", () => {
        it("proposes a responsibility", async () => {
            const { client, generator } = await build()
            generator.generate.mockResolvedValue(
                '{"title":"Follow up","owner_kind":"agent","owner_handle":"sales","next_action":"Call","due_in_days":2,"rationale":"routine"}',
            )

            await expect(client.proposeResponsibility(scope, lead, "ctx", [agent], "Owner")).resolves.toEqual({
                title: "Follow up",
                owner_kind: "agent",
                owner_handle: "sales",
                next_action: "Call",
                due_in_days: 2,
                rationale: "routine",
            })
            expect(generator.generate.mock.calls[0]?.[0]).toMatchObject({ json: true, purpose: "sales:engine" })
            expect(generator.generate.mock.calls[0]?.[0].messages[1]?.content).toContain('"handle":"mai"')
        })

        it("designs a module from a description", async () => {
            const { client, generator } = await build()
            generator.generate.mockResolvedValue('{"name":"Bot","handle":"bot","role":"Helper","instructions":"Do"}')

            await expect(client.designModule(scope, "a helper")).resolves.toEqual({
                name: "Bot",
                handle: "bot",
                role: "Helper",
                instructions: "Do",
            })
            expect(generator.generate.mock.calls[0]?.[0]).toMatchObject({ purpose: "setup:setup", module: "setup" })
        })

        it("classifies a lead", async () => {
            const { client, generator } = await build()
            generator.generate.mockResolvedValue(
                '{"stage":"qualified","confidence":0.8,"next_action":"Call","missing":[],"context":"- who"}',
            )

            await expect(client.classifyLead(scope, lead, ["h"], " BRIEF")).resolves.toMatchObject({
                stage: "qualified",
                confidence: 0.8,
            })
            expect(generator.generate.mock.calls[0]?.[0].messages[0]?.content).toContain("BRIEF")

            await client.classifyLead(scope, lead, [], "")
            expect(generator.generate.mock.calls[1]?.[0].messages[1]?.content).toContain("(none)")
        })

        it("extracts an order with the money phrase from the catalog", async () => {
            const { client, generator } = await build()
            generator.generate.mockResolvedValue('{"items":"Combo","amount_vnd":1500000,"confidence":0.9}')

            await expect(client.extractOrder(scope, "1,5 trieu combo")).resolves.toEqual({
                items: "Combo",
                amount_vnd: 1500000,
                confidence: 0.9,
            })
            expect(generator.generate.mock.calls[0]?.[0]).toMatchObject({
                purpose: "accounting:engine",
                module: "accounting",
            })
            expect(generator.generate.mock.calls[0]?.[0].messages[0]?.content).toContain("[prompts.orderMoney]")
        })

        it("reads the owner's authority chat", async () => {
            const { client, generator } = await build()
            generator.generate.mockResolvedValue('{"policies_add":["Deposit"],"understood":true}')

            await expect(client.parseAuthorityChat(scope, "ask me first", "confirm_order=ask")).resolves.toMatchObject({
                policies_add: ["Deposit"],
                understood: true,
            })
            const content = generator.generate.mock.calls[0]?.[0].messages[0]?.content
            expect(content).toContain("[prompts.authorityMoney]")
            expect(content).toContain("[prompts.authorityHints]")
            expect(content).toContain("Current rules: confirm_order=ask")
        })
    })

    describe("command proposal", () => {
        it("reads an owner message into a command under its own usage kind", async () => {
            const { client, generator } = await build()
            generator.generate.mockResolvedValue('{"intent":"command","command":"issue_receipt","subject_id":"o-1"}')

            await expect(
                client.proposeCommands(scope, {
                    agentName: "Accounting",
                    options: [],
                    customers: [],
                    orders: [],
                    text: "go",
                }),
            ).resolves.toMatchObject({ intent: "command", command: "issue_receipt", subject_id: "o-1", fields: {} })

            expect(generator.generate.mock.calls[0]?.[0]).toMatchObject({
                purpose: "office:office_command",
                json: true,
                kind: "office_command",
                module: "office",
            })
        })
    })

    describe("json parsing", () => {
        it("reads a fenced answer and an object inside prose", async () => {
            const { client, generator } = await build()
            generator.generate
                .mockResolvedValueOnce('```json\n{"name":"A","handle":"a","role":"r","instructions":"i"}\n```')
                .mockResolvedValueOnce('Here you go: {"name":"B","handle":"b","role":"r","instructions":"i"} enjoy')

            await expect(client.designModule(scope, "x")).resolves.toMatchObject({ name: "A" })
            await expect(client.designModule(scope, "x")).resolves.toMatchObject({ name: "B" })
        })

        it("asks again once when the model answered in prose, then reads the object", async () => {
            const { client, generator, logger } = await build()
            generator.generate
                .mockResolvedValueOnce("I think the name is A")
                .mockResolvedValueOnce('{"name":"A","handle":"a","role":"r","instructions":"i"}')

            await expect(client.designModule(scope, "x")).resolves.toMatchObject({ name: "A" })

            expect(generator.generate).toHaveBeenCalledTimes(2)
            expect(generator.generate.mock.calls[1]?.[0].messages.at(-1)).toEqual({
                role: "system",
                content: "Answer again with ONLY the JSON object described above. No prose, no code fences.",
            })
            expect(logger.warn).toHaveBeenCalled()
        })

        it("treats a JSON value that is not an object as prose", async () => {
            const { client, generator } = await build()
            generator.generate
                .mockResolvedValueOnce("[1,2]")
                .mockResolvedValueOnce('{"name":"A","handle":"a","role":"r","instructions":"i"}')

            await expect(client.designModule(scope, "x")).resolves.toMatchObject({ name: "A" })
        })

        it("fails with a typed error when the model never answers with JSON", async () => {
            const { client, generator } = await build(1)
            generator.generate.mockResolvedValue("no json here")

            await expect(client.designModule(scope, "x")).rejects.toMatchObject({
                code: DeepseekErrorCode.JsonNotReturned,
            })
            expect(generator.generate).toHaveBeenCalledTimes(2)
        })

        it("does not ask again when no retries are configured", async () => {
            const { client, generator } = await build(0)
            generator.generate.mockResolvedValue("no json here")

            await expect(client.designModule(scope, "x")).rejects.toMatchObject({
                code: DeepseekErrorCode.JsonNotReturned,
            })
            expect(generator.generate).toHaveBeenCalledTimes(1)
        })
    })
})
