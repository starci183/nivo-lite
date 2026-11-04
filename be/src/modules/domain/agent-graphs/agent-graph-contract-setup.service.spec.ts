import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AGENTS_INSTALLATIONS } from "@modules/domain/agents"
import type { InstallationDirectory } from "@modules/domain/agents"
import { DirectGenerationService } from "@modules/domain/ai-generations"
import { IntentRegistryService } from "@modules/domain/intent-contracts"
import type { FrameAction } from "@modules/domain/intent-contracts"
import { testRegistry } from "@tests/fixtures/builders/intent-domain.builder"
import { BrainFactsService } from "@modules/domain/brain-facts"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import { ModulesService } from "@modules/domain/modules"
import type { SetupApplier } from "@modules/domain/modules"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { END, TRIGGER, nodeOf, stateOf } from "@tests/fixtures/builders/agent-graph.builder"
import { AgentGraphContractSetupService } from "./agent-graph-contract-setup.service"
import { AgentGraphProposalsService } from "./agent-graph-proposals.service"
import { AgentGraphsService } from "./agent-graphs.service"
import { valueHashOf } from "./policies/conflict.policy"
import type { OptionalGraphState } from "./agent-graphs.service"
import type { GraphDocument } from "./agent-graphs.contracts"
import { wakeSources } from "@modules/domain/agent-work"
import type { AgentWakeTraits } from "@modules/domain/agent-wake-rules"
import { GENERIC_WEBHOOK } from "@modules/domain/agent-inbound"

const APPLIER = {
    workspaceId: "ws-1",
    principalId: "user-1",
    installationId: "inst-1",
    contextVersionId: "cv-1",
    version: 1,
} satisfies SetupApplier

const ACTIONS = ["reply_customer", "send_quote"].map((action) => ({ action, amountLimit: action === "send_quote" }))

const RECORD = {
    id: "f1",
    subjectLabel: "Deposit",
    attributeLabel: "Rate",
    value: "30% of the booking",
}

const ACTIVE: GraphDocument = {
    nodes: [
        nodeOf({ ...TRIGGER, key: "msg", next: ["answer"] }),
        nodeOf({ ...TRIGGER, key: "tag", step: "tag", next: ["quote"] }),
        nodeOf({ key: "answer", action: "reply_customer", title: "Answer", next: ["end"] }),
        nodeOf({ key: "quote", action: "send_quote", title: "Quote", next: ["end"] }),
        END,
    ],
    rights: [],
}

const SOURCE = { kind: "brain" as const, factId: "f1", passage: RECORD.value, valueHash: valueHashOf(RECORD.value) }

/** The graph when the contract the model will propose is already published. */
const HOLDING: GraphDocument = {
    ...ACTIVE,
    contracts: [
        {
            intent: "reply_customer",
            task: "A booking means a deposit.",
            limits: [{ text: "Deposit is 30%.", triggers: [], trusts: [], sources: [SOURCE] }],
            sources: [SOURCE],
        },
    ],
}

const answer = (contracts: unknown) => ({
    ok: true as const,
    output: JSON.stringify({ contracts }),
    generationId: "g1",
})

const MODEL = answer([
    {
        intent: "reply_customer",
        task: "A booking means a deposit.",
        task_fact_ids: ["f1"],
        limits: [{ text: "Deposit is 30%.", triggers: [], trusts: [], fact_ids: ["f1"] }],
    },
])

interface Options {
    readonly state?: OptionalGraphState
    readonly records?: ReadonlyArray<typeof RECORD>
    readonly generation?: unknown
    readonly version?: unknown
    readonly installed?: boolean
    readonly multi?: boolean
}

const READ_VERSION = {
    version: 1,
    summary: "Anything above 9.000.000 needs approval.",
    gates: [],
    facts: [],
    toneEvidence: "",
}

const real = testRegistry()
const registry = mock<IntentRegistryService>({
    frameOf: jest.fn((intent: string, actions: ReadonlyArray<FrameAction>, trigger: string, requestAllowed?: boolean) =>
        real.frameOf(intent, actions, trigger, requestAllowed),
    ),
    needsAnswer: jest.fn((trigger: string) => real.needsAnswer(trigger)),
})

const build = async (options: Options = {}) => {
    wakeSources.add(GENERIC_WEBHOOK, {
        priority: 30,
        maxAttempts: 3,
        scopedToConversation: false,
        background: false,
        restoresHeld: true,
        awaitsAnswer: false,
    } satisfies AgentWakeTraits)
    const state =
        options.state === undefined ? stateOf({ active: ACTIVE, activeVersionId: "version-1" }) : options.state
    const installation =
        options.installed === false ? null : { id: "inst-1", moduleKey: "chatbot", isMulti: options.multi !== false }
    const graphs = mock<AgentGraphsService>({ stateOfInstallation: jest.fn().mockResolvedValue(state) })
    const installations = mock<InstallationRecordsService>({ findById: jest.fn().mockResolvedValue(installation) })
    const modules = mock<ModulesService>({ find: jest.fn().mockResolvedValue({ authorityActions: ACTIONS }) })
    const facts = mock<BrainFactsService>({ forView: jest.fn().mockResolvedValue(options.records ?? [RECORD]) })
    const generations = mock<DirectGenerationService>({ run: jest.fn().mockResolvedValue(options.generation ?? MODEL) })
    const proposals = mock<AgentGraphProposalsService>({
        raiseContract: jest.fn().mockResolvedValue(true),
        raiseGap: jest.fn().mockResolvedValue(true),
    })
    const version = options.version === undefined ? READ_VERSION : options.version
    const directory = mock<InstallationDirectory>({ contextVersionOf: jest.fn().mockResolvedValue(version) })
    const catalog = mock<MessageCatalog>({ get: jest.fn((key: string) => `[${key}]`) })
    const logger = mock<Logger>({ error: jest.fn() })
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentGraphContractSetupService,
            { provide: AgentGraphsService, useValue: graphs },
            { provide: InstallationRecordsService, useValue: installations },
            { provide: ModulesService, useValue: modules },
            { provide: BrainFactsService, useValue: facts },
            { provide: DirectGenerationService, useValue: generations },
            { provide: AgentGraphProposalsService, useValue: proposals },
            { provide: AGENTS_INSTALLATIONS, useValue: directory },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: LOGGER, useValue: logger },
            { provide: IntentRegistryService, useValue: registry },
        ],
    }).compile()
    return { service: moduleRef.get(AgentGraphContractSetupService), generations, facts, proposals, logger }
}

describe("AgentGraphContractSetupService.proposeFor", () => {
    it("proposes business text for a configured signed custom webhook through the canonical catalogue frame", async () => {
        const active: GraphDocument = {
            nodes: [
                {
                    ...nodeOf({ ...TRIGGER, key: "payment-event", step: "event", next: ["quote"] }),
                    trigger: { eventTypes: ["payment.received"], sources: ["generic_webhook"] },
                },
                nodeOf({ key: "quote", action: "send_quote", title: "Quote", next: ["end"] }),
                END,
            ],
            rights: [],
        }
        const { service, generations, proposals } = await build({
            version: null,
            state: stateOf({ active, activeVersionId: "version-1" }),
            generation: answer([
                { intent: "send_quote", task: "Use the approved deposit rate.", task_fact_ids: ["f1"], limits: [] },
            ]),
        })

        await expect(service.proposeFor(APPLIER)).resolves.toBe(1)
        expect(jest.mocked(generations.run).mock.calls[0]?.[0].messages[1]?.content).toContain("- send_quote: Quote")
        expect(proposals.raiseContract).toHaveBeenCalledWith(
            "ws-1",
            "agent-1",
            "version-1",
            expect.objectContaining({ intent: "send_quote", task: "Use the approved deposit rate." }),
            ["f1"],
        )
    })

    it("proposes nothing from an unregistered source or a customer catalogue-action fallback", async () => {
        const unknown: GraphDocument = {
            nodes: [
                {
                    ...nodeOf({ ...TRIGGER, key: "event", step: "event", next: ["quote"] }),
                    trigger: { eventTypes: ["payment.received"], sources: ["setup_unregistered_source"] },
                },
                nodeOf({ key: "quote", action: "send_quote", next: ["end"] }),
                END,
            ],
            rights: [],
        }
        const customer: GraphDocument = {
            nodes: [
                {
                    ...nodeOf({ ...TRIGGER, key: "customer", next: ["quote"] }),
                    trigger: { eventTypes: ["customer_message"], sources: ["customer"] },
                },
                nodeOf({ key: "quote", action: "send_quote", next: ["end"] }),
                END,
            ],
            rights: [],
        }
        const invalid = await build({
            version: null,
            state: stateOf({ active: unknown, activeVersionId: "version-1" }),
        })
        const outward = await build({
            version: null,
            state: stateOf({ active: customer, activeVersionId: "version-1" }),
        })
        await expect(invalid.service.proposeFor(APPLIER)).resolves.toBe(0)
        await expect(outward.service.proposeFor(APPLIER)).resolves.toBe(0)
        expect(invalid.generations.run).not.toHaveBeenCalled()
        expect(outward.generations.run).not.toHaveBeenCalled()
    })
})

describe("AgentGraphContractSetupService.proposeFor business facts", () => {
    it("asks the model once for the intents the graph offers and raises each contract it can back with Brain facts", async () => {
        const { service, generations, facts, proposals } = await build({ version: null })

        await expect(service.proposeFor(APPLIER)).resolves.toBe(1)

        expect(facts.forView).toHaveBeenCalledWith("ws-1", "internal", "chatbot", "inst-1", 500)
        const request = jest.mocked(generations.run).mock.calls[0]?.[0]
        expect(request).toMatchObject({ purpose: "setup_chat", responseFormat: "json", kind: "setup", module: "setup" })
        expect(request?.messages[1]?.content).toContain("- reply_customer: Answer")
        expect(request?.messages[1]?.content).toContain("- send_quote: Quote")
        expect(request?.messages[1]?.content).toContain(
            '<data kind="brain_facts">\nf1 | Deposit | Rate: 30% of the booking\n</data>',
        )
        expect(proposals.raiseContract).toHaveBeenCalledWith(
            "ws-1",
            "agent-1",
            "version-1",
            expect.objectContaining({ intent: "reply_customer", task: "A booking means a deposit." }),
            ["f1"],
        )
    })

    it("reads the facts of the whole workspace for an installation that is not one of several", async () => {
        const { service, facts } = await build({ version: null, multi: false })

        await service.proposeFor(APPLIER)

        expect(facts.forView).toHaveBeenCalledWith("ws-1", "internal", "chatbot", null, 500)
    })

    it("raises no contract for a limit that cites no fact, an intent not offered, or one the graph already holds", async () => {
        const invented = await build({
            version: null,
            generation: answer([
                { intent: "reply_customer", task: "Invented.", limits: [{ text: "Invented.", fact_ids: ["nope"] }] },
                { intent: "invent_work", task: "x", task_fact_ids: ["f1"], limits: [] },
            ]),
        })
        const held = await build({ version: null, state: stateOf({ active: HOLDING, activeVersionId: "version-1" }) })

        await expect(invented.service.proposeFor(APPLIER)).resolves.toBe(0)
        await expect(held.service.proposeFor(APPLIER)).resolves.toBe(0)
        expect(invented.proposals.raiseContract).not.toHaveBeenCalled()
    })

    it("counts only the proposals that were new", async () => {
        const { service, proposals } = await build({ version: null })
        jest.mocked(proposals.raiseContract).mockResolvedValue(false)

        await expect(service.proposeFor(APPLIER)).resolves.toBe(0)
    })
})

describe("AgentGraphContractSetupService.proposeFor when there is nothing to propose", () => {
    it("proposes nothing for a model that failed or answered what is not the contract", async () => {
        const failed = await build({ version: null, generation: { ok: false, reason: "timeout", message: "busy" } })
        const text = await build({ version: null, generation: { ok: true, output: "no json here", generationId: "g" } })
        const shape = await build({
            version: null,
            generation: { ok: true, output: '{"contracts": 3}', generationId: "g" },
        })

        await expect(failed.service.proposeFor(APPLIER)).resolves.toBe(0)
        await expect(text.service.proposeFor(APPLIER)).resolves.toBe(0)
        await expect(shape.service.proposeFor(APPLIER)).resolves.toBe(0)
        expect(failed.proposals.raiseContract).not.toHaveBeenCalled()
    })

    it("asks nothing of the model when the Brain holds no fact, the graph offers no intent or the installation is gone", async () => {
        const empty = await build({ version: null, records: [] })
        const idle = await build({
            version: null,
            state: stateOf({ active: { nodes: [END], rights: [] }, activeVersionId: "version-1" }),
        })
        const gone = await build({ version: null, installed: false })

        await expect(empty.service.proposeFor(APPLIER)).resolves.toBe(0)
        await expect(idle.service.proposeFor(APPLIER)).resolves.toBe(0)
        await expect(gone.service.proposeFor(APPLIER)).resolves.toBe(0)
        expect(empty.generations.run).not.toHaveBeenCalled()
        expect(idle.generations.run).not.toHaveBeenCalled()
    })

    it("does nothing for a graph with no published version, another workspace, or none at all", async () => {
        const fresh = await build({ state: stateOf({ active: null, activeVersionId: null }) })
        const other = await build({ state: stateOf({ workspaceId: "ws-2", active: ACTIVE }) })
        const none = await build({ state: null })

        await expect(fresh.service.proposeFor(APPLIER)).resolves.toBe(0)
        await expect(other.service.proposeFor(APPLIER)).resolves.toBe(0)
        await expect(none.service.proposeFor(APPLIER)).resolves.toBe(0)
        expect(fresh.generations.run).not.toHaveBeenCalled()
    })

    it("raises a gap for a rule only the prose of the setup states, never a second one for the same sentence", async () => {
        const { service, proposals } = await build({ generation: answer([]) })

        await expect(service.proposeFor(APPLIER)).resolves.toBe(1)

        expect(proposals.raiseGap).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            agentId: "agent-1",
            versionId: "version-1",
            trigger: "customer_message",
            question: "Anything above 9.000.000 needs approval",
            topic: "[intentContracts.setup.unheldTopic]",
        })
    })

    it("raises no gap when the setup has no context version", async () => {
        const { service, proposals } = await build({ generation: answer([]), version: null })

        await expect(service.proposeFor(APPLIER)).resolves.toBe(0)
        expect(proposals.raiseGap).not.toHaveBeenCalled()
    })

    it("never fails the setup: a failure is logged with ids only and counts for nothing", async () => {
        const { service, generations, logger } = await build({ version: null })
        jest.mocked(generations.run).mockRejectedValue(new Error("engine down"))

        await expect(service.proposeFor(APPLIER)).resolves.toBe(0)

        expect(logger.error).toHaveBeenCalledWith("agent_graphs.contract_setup_failed", expect.any(Error), {
            workspaceId: "ws-1",
            installationId: "inst-1",
        })
    })
})
