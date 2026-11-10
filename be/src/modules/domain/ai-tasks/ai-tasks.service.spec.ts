import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { AI } from "@modules/integrations/ai"
import type { AiService } from "@modules/integrations/ai"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { TIMER } from "@modules/platform/retry"
import type { Timer } from "@modules/platform/retry"
import {
    ANSWER,
    BOT,
    COMBO_ORDER,
    DESIGN_A_JSON,
    DESIGN_JSON,
    RESPONSIBILITY,
    USAGE,
    agent,
    dataUrls,
    lead,
    leadTurnInput,
} from "@tests/fixtures/builders/ai-tasks-service.builder"
import { AiTasksService } from "./ai-tasks.service"
import { NodeImagesService } from "./node-images.service"
import { NotesService } from "./notes.service"
import type { AiTaskScope } from "./ai-tasks.contracts"
import { AI_TASKS_METER, AI_TASKS_OPTIONS } from "./ai-tasks.decorators"
import type { AiTasksOptions } from "./ai-tasks.options"
import type { AiTaskMeter } from "./ai-tasks.port"
import { AiTasksErrorCode } from "./errors/ai-tasks.error"
import { leadTurnPrompt } from "./lead-turn-prompt.policy"
import { ORDER_SCHEMA } from "./ai-tasks.schema"

const scope: AiTaskScope = { workspaceId: "ws-1", locale: "vi" }

/** What a spec scripts and reads back: the prompt the endpoint was sent, with the identity the call was metered under once it answered. */
interface Sent extends Pick<Parameters<AiService["chat"]>[0], "messages" | "json"> {
    workspaceId?: string
    kind?: string
    module?: string
}

const build = async (_unused = 1, available = true, limits: Partial<AiTasksOptions> = {}) => {
    const generator = { generate: jest.fn<Promise<string>, [Sent]>() }
    const ai = mock<AiService>()
    ai.available.mockReturnValue(available)
    // The loop's try is timed: the stopwatch of a spec reads 1.2 s.
    ai.stopwatch.mockReturnValue(() => 1_200)
    ai.attempt.mockImplementation(async (request) => {
        const answer = await ai.chat(request)
        return answer === null ? { ok: false, failure: "timeout" } : { ok: true, answer }
    })
    const sent: Array<Sent> = []
    ai.chat.mockImplementation(async ({ messages, json }) => {
        const prompt: Sent = { messages, json }
        sent.push(prompt)
        return { ...ANSWER, text: await generator.generate(prompt), usage: USAGE, model: "m" }
    })
    const meter = mock<AiTaskMeter>()
    const notes = mock<NotesService>()
    meter.blockedBy.mockResolvedValue(null)
    meter.record.mockImplementation(({ workspaceId, kind, module }) => {
        Object.assign(sent.at(-1) ?? {}, { workspaceId, kind, module })
        return Promise.resolve()
    })
    const logger = mock<Logger>()
    // The pause before a retry runs at once, and is recorded.
    const timer = mock<Timer>({
        schedule: jest.fn((callback: () => void) => {
            callback()
            return () => undefined
        }),
    })
    const images = mock<NodeImagesService>({ inline: jest.fn(dataUrls) })
    const catalog = mock<MessageCatalog>({ get: jest.fn((key: string) => `[${key}]`) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            AiTasksService,
            { provide: AI_TASKS_OPTIONS, useValue: { timeoutMs: 30_000, ...limits } },
            { provide: AI, useValue: ai },
            { provide: AI_TASKS_METER, useValue: meter },
            { provide: NotesService, useValue: notes },
            { provide: NodeImagesService, useValue: images },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: LOGGER, useValue: logger },
            { provide: TIMER, useValue: timer },
        ],
    }).compile()
    return { client: moduleRef.get(AiTasksService), generator, ai, meter, notes, logger, catalog, images, timer }
}

describe("AiTasksService text prompts", () => {
    it("summarises a context for the sales module in the reader's language", async () => {
        const { client, generator, catalog } = await build()
        generator.generate.mockResolvedValue("- who")

        await expect(client.summarizeContext(scope, lead, ["said hi"])).resolves.toBe("- who")

        const request = generator.generate.mock.calls[0]?.[0]
        expect(request).toMatchObject({
            workspaceId: "ws-1",
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
        expect(request).toMatchObject({ kind: "owner_chat", module: "office" })
        expect(request?.messages[0]?.content).toContain("Workspace state:\nstate")
        expect(request?.messages[1]?.content).toBe("a\nb")
    })
})

describe("AiTasksService text prompts, care and tests", () => {
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

describe("AiTasksService json prompts", () => {
    it("reads a lead turn as raw JSON with the catalog voice and lead generation metering", async () => {
        const { client, generator, catalog } = await build()
        const input = leadTurnInput()
        const reading = { reply: "Bookings open at nine.", signals: { wants_meeting: true }, confidence: 0.9 }
        generator.generate.mockResolvedValue(JSON.stringify(reading))

        await expect(client.readLeadTurn(scope, input)).resolves.toEqual(reading)

        expect(catalog.get).toHaveBeenCalledWith("prompts.leadVoice", {}, "vi")
        expect(generator.generate).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            messages: leadTurnPrompt(input, "[prompts.leadVoice]"),
            json: true,
            kind: "chat_reply",
            module: "lead_gen",
        })
    })

    it("proposes a responsibility", async () => {
        const { client, generator } = await build()
        generator.generate.mockResolvedValue(JSON.stringify(RESPONSIBILITY))

        await expect(client.proposeResponsibility(scope, lead, "ctx", [agent], "Owner")).resolves.toEqual(
            RESPONSIBILITY,
        )
        expect(generator.generate.mock.calls[0]?.[0]).toMatchObject({ json: true })
        expect(generator.generate.mock.calls[0]?.[0].messages[1]?.content).toContain('"handle":"mai"')
    })

    it("designs a module from a description", async () => {
        const { client, generator } = await build()
        generator.generate.mockResolvedValue(JSON.stringify(BOT))

        await expect(client.designModule(scope, "a helper")).resolves.toEqual(BOT)
        expect(generator.generate.mock.calls[0]?.[0]).toMatchObject({ module: "setup" })
    })
})

describe("AiTasksService json prompts, classification", () => {
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
        generator.generate.mockResolvedValue(JSON.stringify(COMBO_ORDER))

        await expect(client.extractOrder(scope, "1,5 trieu combo")).resolves.toEqual(COMBO_ORDER)
        expect(generator.generate.mock.calls[0]?.[0]).toMatchObject({
            module: "accounting",
        })
        expect(generator.generate.mock.calls[0]?.[0].messages[0]?.content).toContain("[prompts.orderMoney]")
    })
})

describe("AiTasksService node calls and authority", () => {
    it("runs a graph node's text and JSON calls, metered under the node's namespace", async () => {
        const { client, generator } = await build()
        generator.generate.mockResolvedValueOnce("Hello").mockResolvedValueOnce('{"items":"2 combo"}')
        const ask = { purpose: "order.record:extract", instructions: "Read the order", input: { text: "2 combo" } }

        await expect(client.nodeText(scope, ask)).resolves.toBe("Hello")
        await expect(client.nodeJson(scope, { ...ask, input: undefined }, ORDER_SCHEMA)).resolves.toEqual({
            items: "2 combo",
        })
        expect(generator.generate.mock.calls[0]?.[0]).toMatchObject({
            module: "order",
            messages: [
                { role: "system", content: "Read the order" },
                { role: "user", content: '{"text":"2 combo"}' },
            ],
        })
        expect(generator.generate.mock.calls[1]?.[0].messages[1]?.content).toBe("null")
    })

    it("gives a node's call its own deadline and a bounded reasoning, and leaves a task with the library's", async () => {
        const { client, ai } = await build(1, true, { nodeTimeoutMs: 90_000, nodeReasoning: "low" })
        ai.chat.mockResolvedValue({ ...ANSWER, text: '{"items":"x"}', usage: USAGE, model: "m" })
        const ask = { purpose: "sales.consult-turn:consult", instructions: "i", input: {} }

        await client.nodeJson(scope, ask, ORDER_SCHEMA)
        await client.nodeText(scope, ask)
        await client.summarizeContext(scope, lead, [])

        expect(ai.chat.mock.calls[0]?.[0]).toMatchObject({ timeoutMs: 90_000, budget: { effort: "low" } })
        expect(ai.chat.mock.calls[1]?.[0]).toMatchObject({ timeoutMs: 90_000, budget: { effort: "low" } })
        expect(ai.chat.mock.calls[2]?.[0]).toMatchObject({ timeoutMs: 30_000 })
        expect(ai.chat.mock.calls[2]?.[0]).not.toHaveProperty("budget")
    })

    it("carries a node's pictures as bytes to the AI endpoint", async () => {
        const { client, ai, images } = await build(1, true)
        ai.chat.mockResolvedValue({ ...ANSWER, text: "ok", usage: USAGE, model: "m" })

        await client.nodeText(scope, { purpose: "intent.classify:x", instructions: "i", input: {}, images: ["u1"] })

        expect(images.inline).toHaveBeenCalledWith(["u1"])
        expect(ai.chat.mock.calls[0]?.[0].messages[1]).toMatchObject({ images: ["data:image/png;base64,u1"] })
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

describe("AiTasksService command proposal", () => {
    it("reads an owner message into a command under its own usage kind", async () => {
        const { client, generator } = await build()
        generator.generate.mockResolvedValue('{"intent":"command","command":"issue_receipt","subject_id":"o-1"}')

        const input = { agentName: "Accounting", options: [], customers: [], orders: [], text: "go" }
        await expect(client.proposeCommands(scope, input)).resolves.toMatchObject({
            intent: "command",
            command: "issue_receipt",
            subject_id: "o-1",
            fields: {},
        })

        expect(generator.generate.mock.calls[0]?.[0]).toMatchObject({
            json: true,
            kind: "office_command",
            module: "office",
        })
    })
})

describe("AiTasksService json parsing", () => {
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
        generator.generate.mockResolvedValueOnce("I think the name is A").mockResolvedValueOnce(DESIGN_A_JSON)

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
        generator.generate.mockResolvedValueOnce("[1,2]").mockResolvedValueOnce(DESIGN_A_JSON)

        await expect(client.designModule(scope, "x")).resolves.toMatchObject({ name: "A" })
    })

    it("fails with a typed error when the model never answers with JSON: three tries in all, each named", async () => {
        const { client, generator } = await build()
        generator.generate.mockResolvedValue("no json here")

        await expect(client.designModule(scope, "x")).rejects.toMatchObject({
            code: AiTasksErrorCode.JsonNotReturned,
            params: { tries: 3, failures: "not_json, not_json, not_json" },
        })
        expect(generator.generate).toHaveBeenCalledTimes(3)
    })
})

describe("AiTasksService on the AI endpoint", () => {
    it("fails as unavailable without the AI endpoint: no other door, no quota read, no model call", async () => {
        const { client, ai, meter } = await build(1, false)

        await expect(client.summarizeContext(scope, lead, [])).rejects.toMatchObject({
            code: AiTasksErrorCode.Unavailable,
        })
        await expect(
            client.nodeText(scope, { purpose: "intent.classify:x", instructions: "i", input: {}, images: ["u1"] }),
        ).rejects.toMatchObject({ code: AiTasksErrorCode.Unavailable })

        expect(ai.chat).not.toHaveBeenCalled()
        expect(meter.blockedBy).not.toHaveBeenCalled()
    })

    it("runs the prompt on LangChain once a key is set, within the timeout, and meters the answer", async () => {
        const { client, generator, ai, meter } = await build(1, true)
        ai.chat.mockResolvedValue({ ...ANSWER, text: "- who", model: "work", usage: USAGE })

        await expect(client.summarizeContext(scope, lead, ["said hi"])).resolves.toBe("- who")

        expect(generator.generate).not.toHaveBeenCalled()
        expect(meter.blockedBy).toHaveBeenCalledWith("ws-1", "engine", "vi")
        expect(ai.chat.mock.calls[0]?.[0]).toMatchObject({ json: false, timeoutMs: 30_000 })
        expect(ai.chat.mock.calls[0]?.[0].messages[1]?.content).toContain("said hi")
        expect(meter.record).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            kind: "engine",
            module: "sales",
            usage: { prompt_tokens: 12, completion_tokens: 5, cached_tokens: 0, cost: 0.0002, model: "work" },
            completionChars: 5,
            call: { purpose: null, reasoningTokens: null, durationMs: null, tryNumber: 1, upstream: null, finishReason: null },
        })
    })
})

describe("AiTasksService on the AI endpoint, JSON and refusals", () => {
    it("asks LangChain for JSON on a JSON prompt and books unreported usage as zero", async () => {
        const { client, ai, meter } = await build(1, true)
        const none = { promptTokens: null, completionTokens: null, totalTokens: null, costUsd: null }
        ai.chat.mockResolvedValue({
            ...ANSWER,
            text: DESIGN_A_JSON,
            model: "work",
            usage: none,
        })

        await expect(client.designModule(scope, "x")).resolves.toMatchObject({ name: "A" })

        expect(ai.chat.mock.calls[0]?.[0].json).toBe(true)
        expect(meter.record.mock.calls[0]?.[0].usage).toEqual({
            prompt_tokens: 0,
            completion_tokens: 0,
            cached_tokens: 0,
            cost: 0,
            model: "work",
        })
    })

    it("AI failure: fails twice then answers on the third try, with the same prompt and limits: one metered answer, nothing thrown", async () => {
        const { client, ai, meter, logger } = await build(1, true)
        ai.attempt
            .mockResolvedValueOnce({ ok: false, failure: "timeout" })
            .mockResolvedValueOnce({ ok: false, failure: "length" })
            .mockResolvedValueOnce({ ok: true, answer: { ...ANSWER, text: "thanks", model: "work", usage: USAGE } })

        await expect(client.draftCare(scope, lead, "note", "")).resolves.toBe("thanks")

        expect(ai.attempt).toHaveBeenCalledTimes(3)
        expect(ai.attempt.mock.calls[1]?.[0]).toEqual(ai.attempt.mock.calls[0]?.[0])
        expect(ai.attempt.mock.calls[2]?.[0]).toEqual(ai.attempt.mock.calls[0]?.[0])
        expect(ai.attempt.mock.calls[0]?.[0]).toMatchObject({ affinity: "ws-1" })
        expect(logger.warn).toHaveBeenCalledWith("ai_tasks.retried", {
            workspaceId: "ws-1",
            module: "sales",
            tried: 1,
            failure: "timeout",
            again: true,
        })
        expect(meter.blockedBy).toHaveBeenCalledTimes(1)
        expect(meter.record).toHaveBeenCalledTimes(1)
    })

    it("AI failure: fails three times and stops, naming the tries made and what each failed as; never a fourth try, nothing metered", async () => {
        const { client, ai, meter } = await build(1, true)
        ai.attempt
            .mockResolvedValueOnce({ ok: false, failure: "timeout" })
            .mockResolvedValueOnce({ ok: false, failure: "provider" })
            .mockResolvedValueOnce({ ok: false, failure: "empty" })

        await expect(client.draftCare(scope, lead, "note", "")).rejects.toMatchObject({
            code: AiTasksErrorCode.Unavailable,
            params: { tries: 3, failures: "timeout, provider, empty" },
        })
        expect(ai.attempt).toHaveBeenCalledTimes(3)
        expect(meter.record).not.toHaveBeenCalled()
    })

    it("gives a node call 90 s on its first try and 45 s on each retry (three minutes at worst), and a task 45 s on every try", async () => {
        const limits = { timeoutMs: 45_000, nodeTimeoutMs: 90_000, nodeRetryTimeoutMs: 45_000, nodeReasoning: "low" as const }
        const { client, ai } = await build(1, true, limits)
        ai.attempt.mockResolvedValue({ ok: false, failure: "timeout" })
        const ask = { purpose: "sales.consult-turn:consult", instructions: "i", input: {} }

        await expect(client.nodeJson(scope, ask, ORDER_SCHEMA)).rejects.toMatchObject({ params: { tries: 3 } })
        await expect(client.summarizeContext(scope, lead, [])).rejects.toMatchObject({ params: { tries: 3 } })

        const deadlines = ai.attempt.mock.calls.map(([call]) => call.timeoutMs)
        expect(deadlines).toEqual([90_000, 45_000, 45_000, 45_000, 45_000, 45_000])
        expect(deadlines.slice(0, 3).reduce((sum, ms) => sum + ms, 0)).toBe(180_000)
        // Every try of the node call keeps its bounded reasoning.
        expect(ai.attempt.mock.calls.slice(0, 3).every(([call]) => call.budget?.effort === "low")).toBe(true)
    })

    it("metering: books a node call under its purpose, with the try that answered, its hidden reasoning, upstream, finish and time", async () => {
        const { client, ai, meter } = await build(1, true)
        const served = { upstream: "Together", finishReason: "stop", durationMs: 6_500 }
        ai.attempt.mockResolvedValueOnce({ ok: false, failure: "timeout" }).mockResolvedValueOnce({
            ok: true,
            answer: { ...ANSWER, text: JSON.stringify(COMBO_ORDER), model: "work", usage: { ...USAGE, reasoningTokens: 2_475 }, served },
        })
        const ask = { purpose: "accounting.match-payment:agent", instructions: "i", input: {} }

        await client.nodeJson(scope, ask, ORDER_SCHEMA)

        expect(meter.record).toHaveBeenCalledTimes(1)
        expect(meter.record.mock.calls[0]?.[0]).toMatchObject({
            kind: "engine",
            module: "accounting",
            call: { purpose: "accounting.match-payment:agent", reasoningTokens: 2_475, tryNumber: 2, ...served },
        })
    })

    it("waits two seconds before it retries a provider error, and not at all after a timeout or once no try is left", async () => {
        const { client, ai, timer } = await build(1, true)
        ai.attempt
            .mockResolvedValueOnce({ ok: false, failure: "provider" })
            .mockResolvedValueOnce({ ok: false, failure: "timeout" })
            .mockResolvedValueOnce({ ok: false, failure: "provider" })

        await expect(client.draftCare(scope, lead, "note", "")).rejects.toMatchObject({ params: { tries: 3 } })

        expect(timer.schedule.mock.calls.map(([, ms]) => ms)).toEqual([2000])
    })

    it("AI failure: an answer that is no JSON draws on the same three tries as a timeout, never on a count of its own", async () => {
        const { client, ai } = await build(1, true)
        const prose = { ok: true as const, answer: { ...ANSWER, text: "not json", model: "work", usage: USAGE } }
        ai.attempt
            .mockResolvedValueOnce({ ok: false, failure: "timeout" })
            .mockResolvedValueOnce(prose)
            .mockResolvedValueOnce(prose)

        await expect(client.nodeJson(scope, { purpose: "sales.consult:x", instructions: "i", input: {} }, ORDER_SCHEMA)).rejects.toMatchObject({
            code: AiTasksErrorCode.JsonNotReturned,
            params: { tries: 3, failures: "timeout, not_json, not_json" },
        })
        expect(ai.attempt).toHaveBeenCalledTimes(3)
    })

    it("refuses a workspace over its allowance before calling the endpoint", async () => {
        const { client, ai, meter } = await build(1, true)
        meter.blockedBy.mockResolvedValue({ message: "Over the allowance" })

        await expect(client.draftCare(scope, lead, "note", "")).rejects.toMatchObject({
            code: AiTasksErrorCode.QuotaBlocked,
            params: { message: "Over the allowance" },
        })
        expect(ai.chat).not.toHaveBeenCalled()
    })
})

describe("AiTasksService structured output and notes", () => {
    const lane = { module: "sales", installationId: "i1", audience: "customer" as const }
    const context = { question: "q", limit: 4, search: jest.fn() }
    const reply = { ...ANSWER, text: "Hello", model: "work", usage: USAGE }

    it("hands a JSON task its schema and uses the structured output without parsing the text again", async () => {
        const { client, ai } = await build(1, true)
        ai.chat.mockResolvedValue({ ...reply, text: "not json", parsed: { name: "B" } })

        await expect(client.designModule(scope, "x")).resolves.toMatchObject({ name: "B" })

        expect(ai.chat.mock.calls[0]?.[0].schema).not.toBeNull()
        expect(ai.chat).toHaveBeenCalledTimes(1)
    })

    it("falls back to the loose parse of the text when the answer did not fit the schema", async () => {
        const { client, ai } = await build(1, true)
        ai.chat.mockResolvedValue({ ...reply, text: `Sure: ${DESIGN_JSON}` })

        await expect(client.designModule(scope, "x")).resolves.toMatchObject({ name: "C" })
    })

    it("asks for notes by the next action and the need of a follow-up, and by the need of a thank-you", async () => {
        const { client, ai, notes } = await build(1, true)
        ai.chat.mockResolvedValue(reply)
        notes.contextOf.mockReturnValue(context)

        const followUp = client.draftFollowUp({ ...scope, lane }, lead, "ctx", "call back", null, "")
        await expect(followUp).resolves.toBe("Hello")
        await client.draftCare({ ...scope, lane }, lead, "paid", "")

        expect(notes.contextOf).toHaveBeenNthCalledWith(1, { ...scope, lane }, "call back A quote")
        expect(notes.contextOf).toHaveBeenNthCalledWith(2, { ...scope, lane }, "A quote")
        expect(ai.chat.mock.calls[0]?.[0].context).toBe(context)
    })

    it("sends no schema and no notes with a text prompt", async () => {
        const { client, ai, notes } = await build(1, true)
        ai.chat.mockResolvedValue(reply)
        notes.contextOf.mockReturnValue(null)

        await client.summarizeContext(scope, lead, [])

        expect(ai.chat.mock.calls[0]?.[0]).toMatchObject({ schema: null, context: null })
        expect(notes.contextOf).toHaveBeenCalledWith(scope, null)
    })
})

describe("AiTasksService the turns of a node's agent loop", () => {
    const ASK = { purpose: "accounting.match-payment:agent" }
    const LIMITS = { nodeTimeoutMs: 90_000, nodeRetryTimeoutMs: 45_000, nodeReasoning: "low" as const, nodeMaxTokens: 4000 }
    const READ = {
        ok: true as const,
        model: "work",
        usage: { ...USAGE, cachedTokens: 8, reasoningTokens: 3 },
        textChars: 0,
        toolCalls: 1,
        served: { upstream: "Wafer", finishReason: "tool_calls", durationMs: 1_200 },
    }

    /** The loop's side of a turn: it makes the model call with the client it is given and answers the message. */
    const loopOf = (outcomes: ReadonlyArray<unknown>) => {
        const left = [...outcomes]
        return jest.fn((_model: unknown, _tryNumber: number): Promise<unknown> => {
            const next = left.shift()
            return next instanceof Error ? Promise.reject(next) : Promise.resolve(next)
        })
    }

    it("hands the loop a fresh client per try and answers the message of the first try that is an answer: one metered answer", async () => {
        const { client, ai, meter } = await build(1, true, LIMITS)
        const clients = [{ n: 1 }, { n: 2 }, { n: 3 }]
        ai.turnModel.mockReturnValueOnce(clients[0] as never).mockReturnValueOnce(clients[1] as never).mockReturnValueOnce(clients[2] as never)
        ai.failureOfThrow.mockReturnValue("timeout")
        ai.readTurn.mockReturnValueOnce({ ok: false, failure: "length" }).mockReturnValueOnce(READ)
        const attempt = loopOf([new Error("deadline"), { cut: true }, { message: "third" }])

        const turns = client.nodeAgentTurns(scope, ASK)
        await expect(turns.turn(attempt)).resolves.toEqual({ message: "third" })

        expect(turns.toolChoice).toBe("auto")
        expect(attempt.mock.calls).toEqual([
            [clients[0], 1],
            [clients[1], 2],
            [clients[2], 3],
        ])
        // The first try has the node call's deadline, each retry the shorter one; every try the same reasoning, cap and affinity.
        expect(ai.turnModel.mock.calls.map(([request]) => request)).toEqual([
            { timeoutMs: 90_000, budget: { effort: "low", maxTokens: 4000 }, affinity: "ws-1" },
            { timeoutMs: 45_000, budget: { effort: "low", maxTokens: 4000 }, affinity: "ws-1" },
            { timeoutMs: 45_000, budget: { effort: "low", maxTokens: 4000 }, affinity: "ws-1" },
        ])
        expect(meter.blockedBy).toHaveBeenCalledTimes(1)
        expect(meter.blockedBy).toHaveBeenCalledWith("ws-1", "engine", "vi")
        expect(meter.record).toHaveBeenCalledTimes(1)
        expect(meter.record).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            kind: "engine",
            module: "accounting",
            usage: { prompt_tokens: 12, completion_tokens: 5, cached_tokens: 8, cost: 0.0002, model: "work" },
            completionChars: 0,
            // Metering per call kind: the node's purpose, the hidden reasoning, which try answered, the upstream and the time.
            call: {
                purpose: "accounting.match-payment:agent",
                reasoningTokens: 3,
                durationMs: 1_200,
                tryNumber: 3,
                upstream: "Wafer",
                finishReason: "tool_calls",
            },
        })
        // Each try that made a call was timed, and its time handed to the read of its answer.
        expect(ai.readTurn.mock.calls.map(([, , ms]) => ms)).toEqual([1_200, 1_200])
    })

    it("stops after three tries in all and throws unavailable with the failure of each; nothing is metered", async () => {
        const { client, ai, meter, timer } = await build(1, true, LIMITS)
        ai.turnModel.mockReturnValue({} as never)
        ai.failureOfThrow.mockReturnValueOnce("provider").mockReturnValueOnce("timeout")
        ai.readTurn.mockReturnValue({ ok: false, failure: "empty" })
        const attempt = loopOf([new Error("502"), new Error("deadline"), { empty: true }, { never: true }])

        await expect(client.nodeAgentTurns(scope, ASK).turn(attempt)).rejects.toMatchObject({
            code: AiTasksErrorCode.Unavailable,
            params: { tries: 3, failures: "provider, timeout, empty" },
        })

        expect(attempt).toHaveBeenCalledTimes(3)
        expect(meter.record).not.toHaveBeenCalled()
        // Two seconds before the retry of the provider error only.
        expect(timer.schedule.mock.calls.map(([, ms]) => ms)).toEqual([2000])
    })

    it("refuses a workspace over its allowance before any model call, and fails as unavailable without the endpoint", async () => {
        const over = await build(1, true, LIMITS)
        over.meter.blockedBy.mockResolvedValue({ message: "Over the plan" })
        const attempt = loopOf([{ message: "x" }])

        await expect(over.client.nodeAgentTurns(scope, ASK).turn(attempt)).rejects.toMatchObject({
            code: AiTasksErrorCode.QuotaBlocked,
        })
        const off = await build(1, false, LIMITS)
        await expect(off.client.nodeAgentTurns(scope, ASK).turn(attempt)).rejects.toMatchObject({
            code: AiTasksErrorCode.Unavailable,
        })
        expect(attempt).not.toHaveBeenCalled()
        expect(over.ai.turnModel).not.toHaveBeenCalled()
    })

    it("inlines the pictures of a node's agent as the JSON call does, in order, and reads nothing for no pictures", async () => {
        const { client, images } = await build(1, true)

        await expect(client.nodeImages(scope, ["u1", "u2"])).resolves.toEqual(["data:image/png;base64,u1", "data:image/png;base64,u2"])
        expect(images.inline).toHaveBeenCalledWith(["u1", "u2"])
        // What the inliner leaves out (unreadable, too large) is left out here too.
        images.inline.mockResolvedValueOnce({ images: ["data:image/png;base64,u2"], dropped: 1 })
        await expect(client.nodeImages(scope, ["bad", "u2"])).resolves.toEqual(["data:image/png;base64,u2"])
        images.inline.mockClear()
        await expect(client.nodeImages(scope, [])).resolves.toEqual([])
        expect(images.inline).not.toHaveBeenCalled()
    })

    it("hands the loop the client of a first try to build its agent over, built once and only when read, with the routing of node calls", async () => {
        const routed = { ...LIMITS, nodeRouting: { order: ["together", "wafer"], allowFallbacks: true } }
        const { client, ai } = await build(1, true, routed)
        const first = { first: true }
        ai.turnModel.mockReturnValue(first as never)

        const turns = client.nodeAgentTurns(scope, ASK)
        expect(ai.turnModel).not.toHaveBeenCalled()

        expect(turns.model).toBe(first)
        expect(turns.model).toBe(first)
        expect(ai.turnModel).toHaveBeenCalledTimes(1)
        expect(ai.turnModel.mock.calls[0]?.[0]).toEqual({
            timeoutMs: 90_000,
            budget: { effort: "low", maxTokens: 4000 },
            affinity: "ws-1",
            routing: { order: ["together", "wafer"], allowFallbacks: true },
        })
        // No routing set: the client carries none, so no `provider` field is sent.
        const plain = await build(1, true, LIMITS)
        plain.ai.turnModel.mockReturnValue(first as never)
        void plain.client.nodeAgentTurns(scope, ASK).model
        expect(plain.ai.turnModel.mock.calls[0]?.[0]).not.toHaveProperty("routing")
        // No endpoint configured: no client to build over.
        const off = await build(1, false, LIMITS)
        off.ai.turnModel.mockReturnValue(null)
        expect(off.client.nodeAgentTurns(scope, ASK).model).toBeUndefined()
    })

    it("forces a tool call only on a step whose node asked for no reasoning, and sends that step's own reasoning", async () => {
        const { client, ai } = await build(1, true, LIMITS)
        ai.turnModel.mockReturnValue({} as never)
        ai.readTurn.mockReturnValue(READ)

        const off = client.nodeAgentTurns(scope, { ...ASK, reasoning: "off" })
        await off.turn(loopOf([{ message: "x" }]))

        expect(off.toolChoice).toBe("required")
        expect(ai.turnModel.mock.calls[0]?.[0]).toMatchObject({ budget: { effort: "off", maxTokens: 4000 } })
        expect(client.nodeAgentTurns(scope, { ...ASK, reasoning: "medium" }).toolChoice).toBe("auto")
    })
})
