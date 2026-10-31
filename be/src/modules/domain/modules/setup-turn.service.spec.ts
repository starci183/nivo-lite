import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { DirectGenerationService } from "@modules/domain/ai-generations"
import { BrainFactsService } from "@modules/domain/brain-facts"
import type { FactRecord } from "@modules/domain/brain-facts"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import type { InstallationRecord } from "@modules/domain/module-installations"
import { SetupMessagesService } from "@modules/domain/module-setup-messages"
import type { SetupMessageRecord } from "@modules/domain/module-setup-messages"
import { SetupSessionsService } from "@modules/domain/module-setup-sessions"
import type { SetupSessionRecord } from "@modules/domain/module-setup-sessions"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { CHATBOT_MODULE } from "./chatbot.contracts"
import type { ModuleDefinition } from "./modules.contracts"
import { ModulesService } from "./modules.service"
import { SetupCardsService } from "./setup-cards.service"
import { SetupTurnService } from "./setup-turn.service"

const PAYLOAD = { workspaceId: "ws-1", messageId: "m-2", setupSessionId: "s-1", locale: "en" }

const sessionOf = builder<SetupSessionRecord>({
    id: "s-1",
    workspaceId: "ws-1",
    installationId: "inst-1",
    revision: 1,
    status: "draft",
    draft: { summary: "A shop.", facts: [{ key: "city", text: "Hanoi" }] },
    gateEvidence: { scope: { status: "confirmed", evidence: "Answer customers" } },
    createdAt: "2026-10-01T00:00:00.000Z",
})

const lineOf = builder<SetupMessageRecord>({
    id: "m-2",
    setupSessionId: "s-1",
    role: "user",
    author: "Lan",
    body: "We open 7 to 21",
    createdAt: "2026-10-01T00:01:00.000Z",
})

const installationOf = builder<InstallationRecord>({
    id: "inst-1",
    workspaceId: "ws-1",
    moduleKey: "chatbot",
    name: "Chatbot",
    isMulti: true,
    agentId: "agent-1",
    status: "setup",
    operatingMode: "assist",
    liveEnabled: false,
    activeContextVersionId: null,
    settings: {},
    createdAt: "2026-10-01T00:00:00.000Z",
})

const factOf = builder<FactRecord>({
    id: "f-1",
    subjectType: "business",
    subjectKey: "shop",
    subjectLabel: "Shop",
    attribute: "hours",
    attributeLabel: "Hours",
    value: "8 to 21",
    valueNumber: null,
    unit: null,
    scope: "public",
    modules: [],
    installationId: null,
    status: "active",
    sourceKind: "owner",
    trust: 50,
    validFrom: null,
    validTo: null,
    supersedesId: null,
    conflictWith: null,
    proposalKind: "set",
    evidence: [],
    proposedBy: "u-1",
    proposedAt: "2026-10-01T00:00:00.000Z",
    decidedBy: null,
    decidedAt: null,
    decisionNote: null,
})

const writeOf = (attribute: string, value: string) => ({
    gate: "profile",
    kind: "fact",
    subject: "Shop",
    attribute,
    value,
})

const answerWith = (reply: string, writes: ReadonlyArray<object>): string =>
    JSON.stringify({ reply, summary: "", facts: [], gates: {}, writes })

const MODEL_ANSWER = JSON.stringify({
    reply: "Noted the hours.",
    summary: "A bakery in Hanoi.",
    facts: [{ key: "hours", text: "Open 7 to 21" }],
    gates: {},
    writes: [],
})

const build = async () => {
    const catalog = mock<MessageCatalog>({ get: jest.fn((key: string) => `[${key}]`) })
    const generations = mock<DirectGenerationService>()
    generations.run.mockResolvedValue({
        ok: true,
        output: MODEL_ANSWER,
        generationId: "gen-1",
        timings: {},
        usage: null,
    })
    const installations = mock<InstallationRecordsService>()
    installations.find.mockResolvedValue(installationOf())
    const sessions = mock<SetupSessionsService>()
    sessions.find.mockResolvedValue(sessionOf())
    sessions.save.mockResolvedValue(sessionOf())
    const messages = mock<SetupMessagesService>()
    messages.find.mockResolvedValue(lineOf())
    messages.ofSession.mockResolvedValue([lineOf({ id: "m-1", body: "Hi" }), lineOf()])
    const modules = mock<ModulesService>()
    modules.find.mockResolvedValue(CHATBOT_MODULE)
    const cards = mock<SetupCardsService>()
    cards.openGapsOf.mockResolvedValue([])
    const facts = mock<BrainFactsService>()
    facts.forView.mockResolvedValue([])
    facts.search.mockResolvedValue([])
    const logger = mock<Logger>({ error: jest.fn() })
    const moduleRef = await Test.createTestingModule({
        providers: [
            SetupTurnService,
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: DirectGenerationService, useValue: generations },
            { provide: InstallationRecordsService, useValue: installations },
            { provide: SetupSessionsService, useValue: sessions },
            { provide: SetupMessagesService, useValue: messages },
            { provide: ModulesService, useValue: modules },
            { provide: SetupCardsService, useValue: cards },
            { provide: BrainFactsService, useValue: facts },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return {
        service: moduleRef.get(SetupTurnService),
        generations,
        installations,
        sessions,
        messages,
        cards,
        facts,
        logger,
        catalog,
        modules,
    }
}

describe("SetupTurnService", () => {
    it("leaves a payload of another shape alone", async () => {
        const { service, sessions } = await build()

        await service.run({ workspaceId: "ws-1" })

        expect(sessions.find).not.toHaveBeenCalled()
    })

    it("merges what the model learned into the draft, proposes its writes and posts its reply", async () => {
        const { service, sessions, messages, cards } = await build()

        await service.run(PAYLOAD)

        expect(sessions.save.mock.calls).toEqual([
            [
                "s-1",
                {
                    draft: {
                        summary: "A bakery in Hanoi.",
                        facts: [
                            { key: "city", text: "Hanoi" },
                            { key: "hours", text: "Open 7 to 21" },
                        ],
                    },
                    gateEvidence: { scope: { status: "confirmed", evidence: "Answer customers" } },
                },
            ],
        ])
        expect(cards.propose).toHaveBeenCalledWith("ws-1", "s-1", "m-2", [])
        expect(messages.post.mock.calls).toEqual([
            [
                {
                    workspaceId: "ws-1",
                    setupSessionId: "s-1",
                    role: "assistant",
                    author: "NIVO",
                    body: "Noted the hours.",
                },
            ],
        ])
    })

    it("posts the failure message of the model and keeps the draft", async () => {
        const { service, generations, sessions, messages } = await build()
        generations.run.mockResolvedValue({ ok: false, reason: "timeout", message: "NIVO is busy, try again." })

        await service.run(PAYLOAD)

        expect(sessions.save).not.toHaveBeenCalled()
        expect(messages.post.mock.calls).toEqual([
            [
                {
                    workspaceId: "ws-1",
                    setupSessionId: "s-1",
                    role: "assistant",
                    author: "NIVO",
                    body: "NIVO is busy, try again.",
                },
            ],
        ])
    })

    it("never answers a message twice", async () => {
        const { service, messages, generations } = await build()
        messages.ofSession.mockResolvedValue([lineOf(), lineOf({ id: "m-3", role: "assistant", body: "Done" })])

        await service.run(PAYLOAD)

        expect(generations.run).not.toHaveBeenCalled()
        expect(messages.post.mock.calls).toEqual([])
    })
})

const WRITES_MODULE: ModuleDefinition = {
    ...CHATBOT_MODULE,
    gates: [
        {
            key: "profile",
            label_vi: "Profile",
            label_en: "Profile",
            hint_vi: "Tell about the shop",
            hint_en: "Tell about the shop",
            writes: ["Hours", "Phone", "City"].map((attributeLabel) => ({
                kind: "fact",
                subjectType: "business",
                attributeLabel,
                scope: "public",
            })),
        },
    ],
}

describe("SetupTurnService facts on record", () => {
    it("reads its own scope for a multi instance and puts the lines in the prompt", async () => {
        const { service, facts, generations } = await build()
        facts.forView.mockResolvedValue([factOf()])
        facts.search.mockResolvedValue([factOf()])

        await service.run(PAYLOAD)

        expect(facts.forView).toHaveBeenCalledWith("ws-1", "internal", "chatbot", "inst-1", 500)
        expect(facts.search).toHaveBeenCalledWith("ws-1", "internal", "chatbot", "inst-1", "We open 7 to 21", 30)
        expect(JSON.stringify(generations.run.mock.calls[0])).toContain("- Shop - Hours: 8 to 21")
    })

    it("reads the shared scope for a single instance", async () => {
        const { service, facts, installations } = await build()
        installations.find.mockResolvedValue(installationOf({ isMulti: false }))

        await service.run(PAYLOAD)

        expect(facts.forView).toHaveBeenCalledWith("ws-1", "internal", "chatbot", null, 500)
    })

    it("still answers when the read fails", async () => {
        const { service, facts, logger, messages } = await build()
        facts.forView.mockRejectedValue(new Error("down"))

        await service.run(PAYLOAD)

        expect(logger.error).toHaveBeenCalledTimes(1)
        expect(messages.post).toHaveBeenCalledTimes(1)
    })
})

describe("SetupTurnService conflict notes", () => {
    it("appends one note when a write differs from the record and the reply does not name it", async () => {
        const { service, facts, generations, messages, catalog, modules } = await build()
        modules.find.mockResolvedValue(WRITES_MODULE)
        facts.forView.mockResolvedValue([factOf()])
        generations.run.mockResolvedValue({
            ok: true,
            output: answerWith("Noted.", [writeOf("Hours", "9 to 17")]),
            generationId: "gen-1",
            timings: {},
            usage: null,
        })

        await service.run(PAYLOAD)

        expect(catalog.get).toHaveBeenCalledWith(
            "setup.conflictNote",
            { subject: "Shop", attribute: "Hours", current: "8 to 21", proposed: "9 to 17" },
            "en",
        )
        expect(messages.post.mock.calls[0]?.[0]).toMatchObject({ body: "Noted.\n\n[setup.conflictNote]" })
    })

    it("appends nothing when the reply names the current value", async () => {
        const { service, facts, generations, messages, modules } = await build()
        modules.find.mockResolvedValue(WRITES_MODULE)
        facts.forView.mockResolvedValue([factOf()])
        generations.run.mockResolvedValue({
            ok: true,
            output: answerWith("The record says 8 to 21, which holds?", [writeOf("Hours", "9 to 17")]),
            generationId: "gen-1",
            timings: {},
            usage: null,
        })

        await service.run(PAYLOAD)

        expect(messages.post.mock.calls[0]?.[0]).toMatchObject({ body: "The record says 8 to 21, which holds?" })
    })

    it("appends at most two notes", async () => {
        const { service, facts, generations, messages, modules } = await build()
        modules.find.mockResolvedValue(WRITES_MODULE)
        facts.forView.mockResolvedValue([
            factOf(),
            factOf({ id: "f-2", attribute: "phone", attributeLabel: "Phone", value: "111" }),
            factOf({ id: "f-3", attribute: "city", attributeLabel: "City", value: "Hue" }),
        ])
        generations.run.mockResolvedValue({
            ok: true,
            output: answerWith("Noted.", [writeOf("Hours", "9"), writeOf("Phone", "222"), writeOf("City", "Hanoi")]),
            generationId: "gen-1",
            timings: {},
            usage: null,
        })

        await service.run(PAYLOAD)

        expect(messages.post.mock.calls[0]?.[0]).toMatchObject({
            body: "Noted.\n\n[setup.conflictNote]\n\n[setup.conflictNote]",
        })
    })
})

describe("SetupTurnService", () => {
    it("leaves a closed draft alone", async () => {
        const { service, sessions, generations } = await build()
        sessions.find.mockResolvedValue(sessionOf({ status: "applied" }))

        await service.run(PAYLOAD)

        expect(generations.run).not.toHaveBeenCalled()
    })

    it("leaves a turn whose installation is gone alone", async () => {
        const { service, installations, generations } = await build()
        installations.find.mockResolvedValue(null)

        await service.run(PAYLOAD)

        expect(generations.run).not.toHaveBeenCalled()
    })

    it("posts nothing when the draft closed while the model answered", async () => {
        const { service, sessions, messages, cards } = await build()
        sessions.save.mockResolvedValue(null)

        await service.run(PAYLOAD)

        expect(cards.propose).not.toHaveBeenCalled()
        expect(messages.post.mock.calls).toEqual([])
    })
})
