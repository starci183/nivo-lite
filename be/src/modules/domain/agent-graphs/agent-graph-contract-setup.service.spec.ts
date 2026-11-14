import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AGENTS_INSTALLATIONS } from "@modules/domain/agents"
import type { InstallationDirectory } from "@modules/domain/agents"
import { DirectGenerationService } from "@modules/domain/ai-generations"
import type { SetupApplier } from "@modules/domain/modules"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { END, TRIGGER, nodeOf, stateOf } from "@tests/fixtures/builders/agent-graph.builder"
import { AgentGraphContractSetupService } from "./agent-graph-contract-setup.service"
import { AgentGraphProposalsService } from "./agent-graph-proposals.service"
import { AgentGraphsService } from "./agent-graphs.service"
import type { OptionalGraphState } from "./agent-graphs.service"
import type { GraphDocument } from "./agent-graphs.contracts"

const APPLIER = {
    workspaceId: "ws-1",
    principalId: "user-1",
    installationId: "inst-1",
    contextVersionId: "cv-1",
    version: 1,
} satisfies SetupApplier

const ACTIVE: GraphDocument = {
    nodes: [
        nodeOf({ ...TRIGGER, key: "msg", next: ["answer"] }),
        nodeOf({ key: "answer", action: "reply_customer", title: "Answer", next: ["end"] }),
        END,
    ],
}

/** A request of the generation door, as far as these specs read it. */
type UnheldRequest = Parameters<DirectGenerationService["run"]>[0]

/** True for the reading of the rules the setup text states. */
const isUnheldCall = (request: UnheldRequest): boolean =>
    String(request.messages[0]?.content) === "[agentGraphs.setup.unheldSystem]"

interface Options {
    readonly state?: OptionalGraphState
    /** The rules the model reads from the setup text; none by default. */
    readonly stated?: ReadonlyArray<object>
    /** The raw answer of that reading, in place of `stated`; null for a call that fails. */
    readonly statedOutput?: string | null
    readonly version?: unknown
}

const READ_VERSION = {
    version: 1,
    summary: "Anything above 9.000.000 needs approval.",
    gates: [],
    facts: [],
    toneEvidence: "",
}

const build = async (options: Options = {}) => {
    const state =
        options.state === undefined ? stateOf({ active: ACTIVE, activeVersionId: "version-1" }) : options.state
    const graphs = mock<AgentGraphsService>({ stateOfInstallation: jest.fn().mockResolvedValue(state) })
    const statedOutput = options.statedOutput === undefined ? JSON.stringify({ rules: options.stated ?? [] }) : options.statedOutput
    const generations = mock<DirectGenerationService>({
        run: jest.fn().mockImplementation(() =>
            Promise.resolve(
                statedOutput === null
                    ? { ok: false, reason: "error", message: "busy" }
                    : { ok: true, output: statedOutput, generationId: "g2" },
            ),
        ),
    })
    const proposals = mock<AgentGraphProposalsService>({ raiseGap: jest.fn().mockResolvedValue(true) })
    const version = options.version === undefined ? READ_VERSION : options.version
    const directory = mock<InstallationDirectory>({ contextVersionOf: jest.fn().mockResolvedValue(version) })
    const catalog = mock<MessageCatalog>({ get: jest.fn((key: string) => `[${key}]`) })
    const logger = mock<Logger>({ error: jest.fn() })
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentGraphContractSetupService,
            { provide: AgentGraphsService, useValue: graphs },
            { provide: DirectGenerationService, useValue: generations },
            { provide: AgentGraphProposalsService, useValue: proposals },
            { provide: AGENTS_INSTALLATIONS, useValue: directory },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { service: moduleRef.get(AgentGraphContractSetupService), generations, proposals, logger }
}

describe("AgentGraphContractSetupService.proposeFor when there is nothing to propose", () => {
    it("does nothing for a graph with no published version, another workspace, or none at all", async () => {
        const fresh = await build({ state: stateOf({ active: null, activeVersionId: null }) })
        const other = await build({ state: stateOf({ workspaceId: "ws-2", active: ACTIVE }) })
        const none = await build({ state: null })

        await expect(fresh.service.proposeFor(APPLIER)).resolves.toBe(0)
        await expect(other.service.proposeFor(APPLIER)).resolves.toBe(0)
        await expect(none.service.proposeFor(APPLIER)).resolves.toBe(0)
        expect(fresh.generations.run).not.toHaveBeenCalled()
    })
})

describe("AgentGraphContractSetupService.proposeFor the rules only the setup text states", () => {
    it("raises a gap for a rule the model read from the setup text, with its sum, when the quote is in the text and the graph does not hold it", async () => {
        const { service, proposals, generations } = await build({
            stated: [
                { amount_vnd: 9_000_000, quote: "Anything above 9.000.000 needs approval." },
                { amount_vnd: 7_000_000, quote: "a sentence the setup does not hold" },
            ],
        })

        await expect(service.proposeFor(APPLIER)).resolves.toBe(1)

        expect(proposals.raiseGap).toHaveBeenCalledTimes(1)
        expect(proposals.raiseGap).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            agentId: "agent-1",
            versionId: "version-1",
            trigger: "customer_message",
            question: "Anything above 9.000.000 needs approval.",
            topic: "[intentContracts.setup.unheldTopic]",
            amountVnd: 9_000_000,
        })
        const asked = jest.mocked(generations.run).mock.calls.map(([request]) => request).find(isUnheldCall)
        expect(asked).toMatchObject({ purpose: "setup_chat", responseFormat: "json", kind: "setup", module: "setup" })
        // The setup text travels as a data block of the user message, never inside the instructions.
        expect(asked?.messages[1]?.content).toContain('<data kind="setup_text">')
        expect(asked?.messages[1]?.content).toContain("Anything above 9.000.000 needs approval.")
    })

    it("raises no gap from the words of the setup alone: the model read no rule, or its answer is not the closed shape", async () => {
        const none = await build()
        const unreadable = await build({ statedOutput: '{"rules":[{"amount_vnd":"nine","quote":"x"}]}' })
        const failed = await build({ statedOutput: null })

        await expect(none.service.proposeFor(APPLIER)).resolves.toBe(0)
        await expect(unreadable.service.proposeFor(APPLIER)).resolves.toBe(0)
        await expect(failed.service.proposeFor(APPLIER)).resolves.toBe(0)
        expect(none.proposals.raiseGap).not.toHaveBeenCalled()
        expect(unreadable.proposals.raiseGap).not.toHaveBeenCalled()
        expect(failed.proposals.raiseGap).not.toHaveBeenCalled()
    })

    it("raises no gap when the setup has no context version, and asks the model nothing about it", async () => {
        const { service, proposals, generations } = await build({ version: null })

        await expect(service.proposeFor(APPLIER)).resolves.toBe(0)
        expect(proposals.raiseGap).not.toHaveBeenCalled()
        expect(jest.mocked(generations.run).mock.calls.map(([request]) => request).some(isUnheldCall)).toBe(false)
    })

    it("never fails the setup: a failure is logged with ids only and counts for nothing", async () => {
        const { service, generations, logger } = await build()
        jest.mocked(generations.run).mockRejectedValue(new Error("engine down"))

        await expect(service.proposeFor(APPLIER)).resolves.toBe(0)

        expect(logger.error).toHaveBeenCalledWith("agent_graphs.contract_setup_failed", expect.any(Error), {
            workspaceId: "ws-1",
            installationId: "inst-1",
        })
    })
})
