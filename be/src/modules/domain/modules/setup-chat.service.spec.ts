import { Test } from "@nestjs/testing"
import { FakeClock, builder, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { AgentsService } from "@modules/domain/agents"
import { EventsService } from "@modules/domain/events"
import { ContextVersionsService } from "@modules/domain/module-context-versions"
import type { ContextVersionRecord, GateEntry, GateEvidence } from "@modules/domain/module-context-versions"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import type { InstallationRecord } from "@modules/domain/module-installations"
import { SetupMessagesService } from "@modules/domain/module-setup-messages"
import type { SetupMessageRecord } from "@modules/domain/module-setup-messages"
import { SetupSessionsService } from "@modules/domain/module-setup-sessions"
import type { SetupSessionRecord } from "@modules/domain/module-setup-sessions"
import { InstallationChangesService } from "./installation-changes.service"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { AGENTS_QUEUE_PRODUCER } from "@modules/queues/agents"
import type { AgentsQueue } from "@modules/queues/agents"
import { ACCOUNTING_MODULE } from "./accounting.contracts"
import { ModulesErrorCode } from "./errors/modules.error"
import { ModuleReadinessService } from "./module-readiness.service"
import { ModulesService } from "./modules.service"
import { SetupCardsService } from "./setup-cards.service"
import { SetupChatService } from "./setup-chat.service"

const NOW = "2026-10-13T02:00:00.000Z"

/** Every gate of the accounting module, confirmed by Lan. */
const CONFIRMED: GateEvidence = Object.fromEntries(
    ACCOUNTING_MODULE.gates.map((gate): [string, GateEntry] => [
        gate.key,
        { status: "confirmed", evidence: `About ${gate.key}` },
    ]),
)

const installationOf = builder<InstallationRecord>({
    id: "inst-1",
    workspaceId: "ws-1",
    moduleKey: "accounting",
    name: "Books",
    isMulti: true,
    agentId: null,
    status: "setup",
    operatingMode: "assist",
    liveEnabled: false,
    activeContextVersionId: null,
    settings: {},
    createdAt: NOW,
})

const sessionOf = builder<SetupSessionRecord>({
    id: "s-1",
    workspaceId: "ws-1",
    installationId: "inst-1",
    revision: 1,
    status: "draft",
    draft: { summary: "A bakery.", facts: [] },
    gateEvidence: {},
    createdAt: NOW,
})

const lineOf = builder<SetupMessageRecord>({
    id: "m-1",
    setupSessionId: "s-1",
    role: "user",
    author: "Lan",
    body: "Hello",
    createdAt: NOW,
})

const versionOf = builder<ContextVersionRecord>({
    id: "v-1",
    installationId: "inst-1",
    version: 1,
    snapshot: { summary: "A bakery.", facts: [], gates: CONFIRMED },
    appliedBy: "Lan",
    appliedAt: NOW,
})

/** The agent and version fields of an installation view. */
const VIEWED_AGENT = {
    agentName: "Chatbot",
    agentHandle: "chatbot",
    agentAvatarUrl: null,
    activeVersion: 1,
    setupProgress: { confirmed: 0, total: 8 },
} as const

const build = async () => {
    const tx = fakeTransaction(mockEntityManager())
    const catalog = mock<MessageCatalog>({ get: jest.fn((key: string) => `[${key}]`) })
    const queue = mock<AgentsQueue>()
    const installations = mock<InstallationRecordsService>()
    installations.find.mockResolvedValue(installationOf())
    const sessions = mock<SetupSessionsService>()
    sessions.latest.mockResolvedValue(sessionOf())
    sessions.find.mockResolvedValue(sessionOf())
    const messages = mock<SetupMessagesService>()
    const versions = mock<ContextVersionsService>()
    const members = mock<WorkspaceMembersService>()
    members.require.mockResolvedValue({
        userId: "u1",
        workspaceId: "ws-1",
        role: "owner",
        staffId: null,
        displayName: "Lan",
        status: "active",
    })
    const modules = mock<ModulesService>()
    modules.find.mockResolvedValue(ACCOUNTING_MODULE)
    const agents = mock<AgentsService>()
    const events = mock<EventsService>()
    const sync = mock<InstallationChangesService>()
    const cards = mock<SetupCardsService>()
    const readiness = mock<ModuleReadinessService>()
    readiness.settle.mockResolvedValue("ready")
    readiness.withNeeds.mockImplementation((record) =>
        Promise.resolve({ ...record, ...VIEWED_AGENT, connectionNeeds: [], lifecycle: "ready" }),
    )
    const moduleRef = await Test.createTestingModule({
        providers: [
            SetupChatService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: AGENTS_QUEUE_PRODUCER, useValue: queue },
            { provide: InstallationRecordsService, useValue: installations },
            { provide: SetupSessionsService, useValue: sessions },
            { provide: SetupMessagesService, useValue: messages },
            { provide: ContextVersionsService, useValue: versions },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: ModulesService, useValue: modules },
            { provide: AgentsService, useValue: agents },
            { provide: EventsService, useValue: events },
            { provide: InstallationChangesService, useValue: sync },
            { provide: SetupCardsService, useValue: cards },
            { provide: ModuleReadinessService, useValue: readiness },
        ],
    }).compile()
    return {
        service: moduleRef.get(SetupChatService),
        tx,
        queue,
        installations,
        sessions,
        messages,
        versions,
        agents,
        events,
        sync,
        cards,
        catalog,
        readiness,
    }
}

describe("SetupChatService > state", () => {
    it("answers the open draft, the chat and whether a turn is pending", async () => {
        const { service, sessions, messages, cards } = await build()
        sessions.revisions.mockResolvedValue([{ id: "s-1", revision: 1, status: "draft" }])
        messages.ofInstallation.mockResolvedValue([lineOf({ role: "assistant" }), lineOf({ id: "m-2" })])
        cards.viewsOf.mockResolvedValue([])

        await expect(service.state("u1", "ws-1", "inst-1", "en")).resolves.toEqual({
            installation: { ...installationOf(), ...VIEWED_AGENT, connectionNeeds: [], lifecycle: "ready" },
            session: sessionOf(),
            revisions: [{ id: "s-1", revision: 1, status: "draft" }],
            messages: [lineOf({ role: "assistant" }), lineOf({ id: "m-2" })],
            cards: [],
            turnPending: true,
        })
    })

    it("refuses an installation of another workspace", async () => {
        const { service, installations } = await build()
        installations.find.mockResolvedValue(null)

        await expect(service.state("u1", "ws-1", "inst-1", "en")).rejects.toMatchObject({
            code: ModulesErrorCode.InstallationNotFound,
        })
    })
})

describe("SetupChatService > openDraft", () => {
    it("opens the first revision with a welcome naming the instance", async () => {
        const { service, sessions, messages } = await build()
        sessions.latest.mockResolvedValue(null)
        sessions.open.mockResolvedValue(sessionOf())

        await expect(service.openDraft(installationOf(), "en")).resolves.toEqual(sessionOf())
        expect(sessions.open).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            installationId: "inst-1",
            revision: 1,
            draft: { summary: "", facts: [] },
            gateEvidence: {},
        })
        expect(messages.post).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            setupSessionId: "s-1",
            role: "assistant",
            author: "NIVO",
            body: "[setup.welcome]",
        })
    })

    it("opens the next revision from an applied one without a welcome", async () => {
        const { service, sessions, messages } = await build()
        sessions.latest.mockResolvedValue(sessionOf({ status: "applied", revision: 2, gateEvidence: CONFIRMED }))
        sessions.open.mockResolvedValue(sessionOf({ id: "s-3", revision: 3 }))

        await expect(service.openDraft(installationOf(), "en")).resolves.toMatchObject({ id: "s-3" })
        expect(sessions.open).toHaveBeenCalledWith(expect.objectContaining({ revision: 3, gateEvidence: CONFIRMED }))
        expect(messages.post).not.toHaveBeenCalled()
    })

    it("answers the draft another call opened first", async () => {
        const { service, sessions } = await build()
        sessions.latest.mockResolvedValueOnce(null).mockResolvedValueOnce(sessionOf({ id: "s-other" }))
        sessions.open.mockResolvedValue(null)

        await expect(service.openDraft(installationOf(), "en")).resolves.toMatchObject({ id: "s-other" })
    })
})

describe("SetupChatService > postMessage", () => {
    it("stores the trimmed message and queues the turn in a transaction", async () => {
        const { service, messages, queue, tx } = await build()
        messages.post.mockResolvedValue(lineOf({ id: "m-9" }))

        await expect(service.postMessage("u1", "ws-1", "s-1", "  We open at 7  ", "vi")).resolves.toEqual(
            lineOf({ id: "m-9" }),
        )
        expect(messages.post).toHaveBeenCalledWith(
            {
                workspaceId: "ws-1",
                setupSessionId: "s-1",
                role: "user",
                author: "Lan",
                body: "We open at 7",
            },
            expect.anything(),
        )
        expect(messages.post.mock.calls[0]?.[1]).toBe(queue.enqueueSetupTurn.mock.calls[0]?.[1])
        expect(queue.enqueueSetupTurn.mock.calls[0]?.[0]).toEqual({
            workspaceId: "ws-1",
            messageId: "m-9",
            setupSessionId: "s-1",
            locale: "vi",
        })
        expect(tx.commits).toBe(1)
    })

    it("rolls the message back when its turn cannot be queued", async () => {
        const { service, messages, queue, tx } = await build()
        messages.post.mockResolvedValue(lineOf({ id: "m-9" }))
        queue.enqueueSetupTurn.mockRejectedValue(new Error("queue down"))

        await expect(service.postMessage("u1", "ws-1", "s-1", "Hi", "en")).rejects.toThrow("queue down")
        expect(tx.rollbacks).toBe(1)
    })

    it("refuses a closed draft", async () => {
        const { service, sessions, messages } = await build()
        sessions.find.mockResolvedValue(sessionOf({ status: "applied" }))

        await expect(service.postMessage("u1", "ws-1", "s-1", "Hi", "en")).rejects.toMatchObject({
            code: ModulesErrorCode.SetupSessionClosed,
        })
        expect(messages.post).not.toHaveBeenCalled()
    })
})

describe("SetupChatService > setGate", () => {
    it("confirms an edited gate in the words of the owner", async () => {
        const { service, sessions } = await build()
        sessions.save.mockImplementation((id, change) => Promise.resolve(sessionOf({ id, ...change })))

        const saved = await service.setGate("u1", "ws-1", "s-1", "scope", "edit", "  Invoices only  ")

        expect(saved.gateEvidence).toEqual({
            scope: { status: "confirmed", evidence: "Invoices only", confirmed_by: "Lan", confirmed_at: NOW },
        })
    })

    it("refuses an unknown gate, a gate without evidence and a draft closed meanwhile", async () => {
        const { service, sessions } = await build()
        sessions.save.mockResolvedValue(null)

        await expect(service.setGate("u1", "ws-1", "s-1", "nope", "confirm", "")).rejects.toMatchObject({
            code: ModulesErrorCode.GateUnknown,
        })
        await expect(service.setGate("u1", "ws-1", "s-1", "scope", "confirm", "")).rejects.toMatchObject({
            code: ModulesErrorCode.GateEmpty,
        })
        await expect(service.setGate("u1", "ws-1", "s-1", "scope", "reopen", "")).rejects.toMatchObject({
            code: ModulesErrorCode.SetupSessionClosed,
        })
    })
})

describe("SetupChatService > apply", () => {
    it("refuses to apply a setup to a removed agent", async () => {
        const { service, installations } = await build()
        installations.find.mockResolvedValue(installationOf({ status: "removed" }))

        await expect(service.apply("u1", "ws-1", "inst-1", "en")).rejects.toMatchObject({
            code: ModulesErrorCode.InstallationRemoved,
        })
    })

    it("refuses a draft whose gates are not all confirmed", async () => {
        const { service } = await build()

        await expect(service.apply("u1", "ws-1", "inst-1", "en")).rejects.toMatchObject({
            code: ModulesErrorCode.GatesUnconfirmed,
        })
    })

    it("refuses a draft that says what the version in use says", async () => {
        const { service, sessions, versions, installations } = await build()
        sessions.latest.mockResolvedValue(sessionOf({ gateEvidence: CONFIRMED }))
        installations.find.mockResolvedValue(installationOf({ activeContextVersionId: "v-1" }))
        versions.latest.mockResolvedValue(versionOf())

        await expect(service.apply("u1", "ws-1", "inst-1", "en")).rejects.toMatchObject({
            code: ModulesErrorCode.SetupUnchanged,
        })
    })

    it("applies the draft as the next version, readies the installation and opens a new draft", async () => {
        const { service, sessions, versions, installations, events, sync, readiness } = await build()
        sessions.latest
            .mockResolvedValueOnce(sessionOf({ gateEvidence: CONFIRMED, draft: { summary: "New", facts: [] } }))
            .mockResolvedValueOnce(sessionOf({ status: "applied" }))
        sessions.open.mockResolvedValue(sessionOf({ id: "s-2", revision: 2 }))
        versions.latest.mockResolvedValue(versionOf())
        versions.insert.mockResolvedValue(versionOf({ id: "v-2", version: 2 }))

        await expect(service.apply("u1", "ws-1", "inst-1", "en")).resolves.toBe(2)
        expect(versions.insert).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            installationId: "inst-1",
            version: 2,
            snapshot: { summary: "New", facts: [], gates: CONFIRMED },
            appliedBy: "Lan",
        })
        expect(installations.activateVersion).toHaveBeenCalledWith("ws-1", "inst-1", "v-2", "ready")
        expect(readiness.settle).toHaveBeenCalledWith("ws-1", "inst-1")
        expect(sessions.close).toHaveBeenCalledWith("s-1")
        expect(events.record).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            kind: "module.context_applied",
            actor: "Lan",
            summary: `${ACCOUNTING_MODULE.name.en} v2`,
        })
        expect(sync.announceNow).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            installationId: "inst-1",
            force: false,
        })
    })

    it("writes the setup into the agent of a live installation and keeps its status", async () => {
        const { service, sessions, versions, installations, agents } = await build()
        installations.find.mockResolvedValue(installationOf({ agentId: "agent-1", status: "live" }))
        sessions.latest.mockResolvedValue(sessionOf({ gateEvidence: CONFIRMED }))
        versions.latest.mockResolvedValue(null)
        versions.insert.mockResolvedValue(versionOf())
        agents.profileOf.mockResolvedValue(null)

        await expect(service.apply("u1", "ws-1", "inst-1", "en")).resolves.toBe(1)
        expect(installations.activateVersion).toHaveBeenCalledWith("ws-1", "inst-1", "v-1", "live")
        expect(agents.setTexts).not.toHaveBeenCalled()
    })
})

describe("SetupChatService > versionsOf", () => {
    it("answers the versions and the one in use", async () => {
        const { service, versions, installations } = await build()
        installations.find.mockResolvedValue(installationOf({ activeContextVersionId: "v-1" }))
        versions.list.mockResolvedValue([versionOf()])

        await expect(service.versionsOf("u1", "ws-1", "inst-1")).resolves.toEqual({
            versions: [versionOf()],
            activeVersionId: "v-1",
        })
    })
})

describe("SetupChatService", () => {
    it.each([
        { items: [] },
        { items: [lineOf({ setupSessionId: "older" })] },
        { items: [lineOf({ role: "assistant" })] },
    ])("has no pending turn when this draft has no unanswered user message: %p", async ({ items }) => {
        const { service, sessions, messages, cards } = await build()
        sessions.revisions.mockResolvedValue([{ id: "s-1", revision: 1, status: "draft" }])
        messages.ofInstallation.mockResolvedValue(items)
        cards.viewsOf.mockResolvedValue([])

        expect((await service.state("u1", "ws-1", "inst-1", "en")).turnPending).toBe(false)
        expect(cards.viewsOf).toHaveBeenCalledWith("ws-1", ["s-1"])
    })

    it.each([true, false])("welcomes a first draft with the localized module name (multi: %p)", async (isMulti) => {
        const { service, sessions, catalog } = await build()
        sessions.latest.mockResolvedValue(null)
        sessions.open.mockResolvedValue(sessionOf())

        await expect(service.openDraft(installationOf({ isMulti }), "vi")).resolves.toEqual(sessionOf())
        expect(catalog.get).toHaveBeenCalledWith(
            "setup.welcome",
            { module: isMulti ? `${ACCOUNTING_MODULE.name.vi} - Books` : ACCOUNTING_MODULE.name.vi },
            "vi",
        )
    })

    it("refuses a missing draft after a competing open returned no session", async () => {
        const { service, sessions } = await build()
        sessions.latest.mockResolvedValue(null)
        sessions.open.mockResolvedValue(null)

        await expect(service.openDraft(installationOf(), "en")).rejects.toMatchObject({
            code: ModulesErrorCode.InstallationNotFound,
        })
        expect(sessions.latest).toHaveBeenCalledTimes(2)
    })

    it("refuses a missing session before posting or enqueueing a message", async () => {
        const { service, sessions, messages, queue } = await build()
        sessions.find.mockResolvedValue(null)

        await expect(service.postMessage("u1", "ws-1", "missing", "Hello", "en")).rejects.toMatchObject({
            code: ModulesErrorCode.SetupSessionClosed,
        })
        expect(messages.post).not.toHaveBeenCalled()
        expect(queue.enqueueSetupTurn).not.toHaveBeenCalled()
    })
})

describe("SetupChatService", () => {
    it("replaces old setup blocks when applying a changed active draft to an installing agent", async () => {
        const { service, sessions, versions, installations, agents } = await build()
        installations.find.mockResolvedValue(
            installationOf({ agentId: "agent-1", status: "installing", activeContextVersionId: "v-1" }),
        )
        sessions.latest.mockResolvedValue(
            sessionOf({ draft: { summary: "New bakery.", facts: [] }, gateEvidence: CONFIRMED }),
        )
        versions.latest.mockResolvedValue(versionOf())
        versions.insert.mockResolvedValue(versionOf({ id: "v-2", version: 2 }))
        agents.profileOf.mockResolvedValue({
            id: "agent-1",
            name: "Books",
            handle: "books",
            role: "Accounting",
            approval_rule: "",
            instructions: "Keep these rules.\n\n### NIVO setup v1\nOld rules\n### end NIVO setup",
            knowledge: "Keep these notes.\n\n### NIVO setup v1\nOld notes\n### end NIVO setup",
        })
        const rules = ACCOUNTING_MODULE.gates.map((gate) => `- ${gate.label_en}: About ${gate.key}`).join("\n")

        await expect(service.apply("u1", "ws-1", "inst-1", "en")).resolves.toBe(2)
        expect(installations.activateVersion).toHaveBeenCalledWith("ws-1", "inst-1", "v-2", "ready")
        expect(agents.profileOf).toHaveBeenCalledWith("ws-1", "agent-1")
        expect(agents.setTexts).toHaveBeenCalledWith("u1", "ws-1", "agent-1", {
            instructions:
                "Keep these rules.\n\n### NIVO setup v2\nConfirmed by the owner. " +
                "Follow these rules exactly; when something is not covered, say a team member will confirm.\n" +
                `${rules}\n### end NIVO setup`,
            knowledge: `Keep these notes.\n\n### NIVO setup v2\nNew bakery.\n\n${rules}\n### end NIVO setup`,
        })
        expect(sessions.close).toHaveBeenCalledWith("s-1")
    })
})
