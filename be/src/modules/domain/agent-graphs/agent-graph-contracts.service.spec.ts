import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { IntentRegistryService } from "@modules/domain/intent-contracts"
import type { FrameAction } from "@modules/domain/intent-contracts"
import type { IntentBusiness } from "@modules/domain/intent-contracts"
import { testRegistry } from "@tests/fixtures/builders/intent-domain.builder"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import { ModulesService } from "@modules/domain/modules"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { END, TRIGGER, nodeOf, stateOf } from "@tests/fixtures/builders/agent-graph.builder"
import { AgentGraphContractsService } from "./agent-graph-contracts.service"
import { AgentGraphsService } from "./agent-graphs.service"
import type { OptionalGraphState } from "./agent-graphs.service"
import type { GraphDocument, GraphNode } from "./agent-graphs.contracts"

const CATALOG_ACTIONS = ["reply_customer", "handoff_lead", "confirm_order", "send_quote"].map((action) => ({
    action,
    amountLimit: action === "send_quote",
}))

/** A customer message and a tag, each leading to the writes the graph holds. */
const documentOf = (customerActions: ReadonlyArray<string>, tagActions: ReadonlyArray<string>): GraphDocument => ({
    nodes: [
        nodeOf({ ...TRIGGER, key: "msg", next: customerActions.map((action) => `c-${action}`) }),
        nodeOf({ ...TRIGGER, key: "tag", step: "tag", next: tagActions.map((action) => `t-${action}`) }),
        ...customerActions.map((action) =>
            nodeOf({ key: `c-${action}`, action, title: `Title ${action}`, next: ["end"] }),
        ),
        ...tagActions.map((action) => nodeOf({ key: `t-${action}`, action, title: `Title ${action}`, next: ["end"] })),
        END,
    ],
    rights: [],
})

const real = testRegistry()
const registry = mock<IntentRegistryService>({
    frameOf: jest.fn((intent: string, actions: ReadonlyArray<FrameAction>, trigger: string, requestAllowed?: boolean) =>
        real.frameOf(intent, actions, trigger, requestAllowed),
    ),
    needsAnswer: jest.fn((trigger: string) => real.needsAnswer(trigger)),
})

const build = async (state: OptionalGraphState, installed = true) => {
    const graphs = mock<AgentGraphsService>({ stateOfAgent: jest.fn().mockResolvedValue(state) })
    const installations = mock<InstallationRecordsService>({
        findById: jest.fn().mockResolvedValue(installed ? { id: "inst-1", moduleKey: "chatbot" } : null),
    })
    const modules = mock<ModulesService>({
        find: jest.fn().mockResolvedValue({ authorityActions: CATALOG_ACTIONS }),
    })
    const catalog = mock<MessageCatalog>({ get: jest.fn((key: string) => `[${key}]`) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentGraphContractsService,
            { provide: AgentGraphsService, useValue: graphs },
            { provide: InstallationRecordsService, useValue: installations },
            { provide: ModulesService, useValue: modules },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: IntentRegistryService, useValue: registry },
        ],
    }).compile()
    return { service: moduleRef.get(AgentGraphContractsService), graphs, modules, catalog }
}

const enforced = (active: GraphDocument | null, versionId: string | null = "version-1") =>
    stateOf({
        mode: "enforced",
        active: active === null ? null : { contracts: [], ...active },
        activeVersionId: versionId,
    })

describe("AgentGraphContractsService.turnContractsOf > a version with no contracts", () => {
    it("keeps the turn the agent has until the owner approves contracts into a version", async () => {
        const { service } = await build(
            stateOf({ mode: "enforced", active: { nodes: [], rights: [] }, activeVersionId: "version-1" }),
        )

        await expect(service.turnContractsOf("ws-1", "agent-1", "customer_message", "outsider")).resolves.toBeNull()
    })
})

describe("AgentGraphContractsService.turnContractsOf > a customer message", () => {
    it("merges the frames of the intents the trigger reaches with the business values of the published version", async () => {
        const shop: IntentBusiness = {
            intent: "reply_customer",
            task: "A deposit comes first.",
            limits: [{ text: "Never discount.", triggers: [], trusts: [], sources: [] }],
            sources: [],
        }
        const active = { ...documentOf(["reply_customer", "handoff_lead"], []), contracts: [shop] }
        const { service, graphs } = await build(enforced(active))

        const turn = await service.turnContractsOf("ws-1", "agent-1", "customer_message", "outsider")

        expect(graphs.stateOfAgent).toHaveBeenCalledWith("ws-1", "agent-1")
        expect(turn?.versionId).toBe("version-1")
        expect(turn?.contracts.map((contract) => contract.intent)).toEqual(["reply_customer", "handoff_lead"])
        expect(turn?.contracts[0]).toMatchObject({
            label: "Title reply_customer",
            task: "[task.reply_customer] A deposit comes first.",
            result: "test_answer",
        })
        expect(turn?.contracts[0]?.limits.at(-1)).toBe("Never discount.")
        expect(turn?.contracts[1]?.task).toBe("[task.handoff_lead]")
    })

    it("offers only the intents that have a customer frame, but needs a way to answer", async () => {
        const answers = await build(enforced(documentOf(["reply_customer", "send_quote"], [])))
        const mute = await build(enforced(documentOf(["handoff_lead"], [])))

        const turn = await answers.service.turnContractsOf("ws-1", "agent-1", "customer_message", "outsider")

        expect(turn?.contracts.map((contract) => contract.intent)).toEqual(["reply_customer"])
        await expect(
            mute.service.turnContractsOf("ws-1", "agent-1", "customer_message", "outsider"),
        ).resolves.toBeNull()
    })
})

describe("AgentGraphContractsService.turnContractsOf > a tag", () => {
    it("offers every reached intent as a request, worded for the audience", async () => {
        const { service } = await build(enforced(documentOf([], ["send_quote", "reply_customer"])))

        const manager = await service.turnContractsOf("ws-1", "agent-1", "tag", "manager")
        const staff = await service.turnContractsOf("ws-1", "agent-1", "tag", "member")

        expect(manager?.contracts.map((contract) => [contract.intent, contract.ownTurn, contract.result])).toEqual([
            ["send_quote", true, "agent_request"],
            ["reply_customer", false, "agent_request"],
        ])
        expect(manager?.contracts[0]?.limits).toContain("[intentContracts.limit.request_only]")
        expect(staff?.contracts[0]?.limits).toEqual(["[intentContracts.limit.staff]"])
    })
})

describe("AgentGraphContractsService.turnContractsOf > the turn stays as it was", () => {
    it("refuses an unknown source even when the published graph and an exact domain frame would otherwise fit", async () => {
        const { service } = await build(enforced(documentOf(["reply_customer"], [])))
        await expect(
            service.turnContractsOf("ws-1", "agent-1", "customer_message", "outsider", "unregistered_contract_source"),
        ).resolves.toBeNull()
    })

    it("uses the catalogue request for a registered custom event and preserves source reachability", async () => {
        const document: GraphDocument = {
            ...documentOf([], ["send_quote"]),
            nodes: documentOf([], ["send_quote"]).nodes.map((node): GraphNode =>
                node.key === "tag"
                    ? { ...node, step: "event", trigger: { eventTypes: ["invoice.paid"], sources: ["internal"] } }
                    : node,
            ),
        }
        const { service } = await build(enforced(document))
        const turn = await service.turnContractsOf("ws-1", "agent-1", "invoice.paid", "outsider", "internal")
        expect(turn?.contracts).toEqual([
            expect.objectContaining({ intent: "send_quote", result: "agent_request", ownTurn: true }),
        ])
        await expect(service.turnContractsOf("ws-1", "agent-1", "invoice.paid", "outsider", "tag")).resolves.toBeNull()
        await expect(service.turnContractsOf("ws-1", "agent-1", "invoice.paid", "outsider")).resolves.toBeNull()
    })

    it("a customer source keeps exact reply frames and gains no catalogue request fallback", async () => {
        const offered = await build(enforced(documentOf(["reply_customer"], [])))
        const absent = await build(enforced(documentOf(["send_quote"], [])))
        expect(
            (await offered.service.turnContractsOf("ws-1", "agent-1", "customer_message", "outsider", "customer"))
                ?.contracts[0]?.result,
        ).toBe("test_answer")
        await expect(
            absent.service.turnContractsOf("ws-1", "agent-1", "customer_message", "outsider", "customer"),
        ).resolves.toBeNull()
    })

    it("has no contracts for an agent with no graph, a graph that only records, or no published version", async () => {
        const none = await build(null)
        const shadow = await build(stateOf({ mode: "shadow", active: documentOf(["reply_customer"], []) }))
        const noVersion = await build(enforced(null))
        const noId = await build(enforced(documentOf(["reply_customer"], []), null))

        await expect(none.service.turnContractsOf("ws-1", "a", "customer_message", "outsider")).resolves.toBeNull()
        await expect(shadow.service.turnContractsOf("ws-1", "a", "customer_message", "outsider")).resolves.toBeNull()
        await expect(noVersion.service.turnContractsOf("ws-1", "a", "customer_message", "outsider")).resolves.toBeNull()
        await expect(noId.service.turnContractsOf("ws-1", "a", "customer_message", "outsider")).resolves.toBeNull()
    })

    it("has no contracts when the installation is gone, the trigger reaches nothing or an intent has no frame", async () => {
        const gone = await build(enforced(documentOf(["reply_customer"], [])), false)
        const idle = await build(enforced(documentOf(["reply_customer"], [])))
        const unframed = await build(enforced(documentOf(["reply_customer", "invent_work"], [])))

        await expect(gone.service.turnContractsOf("ws-1", "a", "customer_message", "outsider")).resolves.toBeNull()
        await expect(idle.service.turnContractsOf("ws-1", "a", "tag", "manager")).resolves.toBeNull()
        await expect(unframed.service.turnContractsOf("ws-1", "a", "customer_message", "outsider")).resolves.toBeNull()
    })
})
