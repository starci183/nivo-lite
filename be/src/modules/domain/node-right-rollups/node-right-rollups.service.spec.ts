import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import {
    AgentRightsStandingService,
    AgentStepTitlesService,
    AgentWorkflowsAdminService,
    type WorkflowRightsStanding,
} from "@modules/domain/agent-graphs"
import { AgentDirectoryService } from "@modules/domain/agents"
import { ConnectionBindingsReadService } from "@modules/domain/connections"
import { AccountAttachmentsService } from "@modules/domain/tool-grants"
import { ProviderOfferService, type ProviderOffer } from "@modules/domain/provider-offer"
import { ProviderTriggerStatesService } from "@modules/domain/provider-triggers"
import { INSTALLED } from "@modules/domain/installed-plugins"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { NodeRightRollupsError, NodeRightRollupsErrorCode } from "./errors/node-right-rollups.error"
import { templateRequestsOf } from "./node-right-rollups.policy"
import { NodeRightRollupsService } from "./node-right-rollups.service"
import { TestWorldError, TestWorldErrorCode } from "@tests/world/test-world.error"

/** The newest version of the shipped reconcile template (the catalogue keeps one version per template graph since the flip). */
const CONSULT_NEWEST = INSTALLED.templateOf("sales.consult")?.versions.slice(-1)[0]?.version ?? 0

const ACTOR = { principalId: "user-1", workspaceId: "ws-1" }

/** A template as the template door answers it. */
type TemplateWire = Awaited<ReturnType<AgentWorkflowsAdminService["template"]>>

const offerOf = builder<ProviderOffer>({ connectionId: "c-zalo", provider: "zalo_oa", api: [], mcp: [], triggers: [] })

const standingOf = builder<WorkflowRightsStanding>({
    workflowId: "wf-1",
    agentId: "agent-1",
    versionId: "wfv-1",
    graph: {
        schema: "nivo/agent-graph@1",
        moduleKey: "chatbot",
        trigger: { kind: "tag", sources: ["channel"] },
        grant: { tools: [], effects: [] },
        nodes: [{ key: "answer", kind: "execute", step: "chatbot.answer" }],
    },
    workflowKey: "front-desk",
    workflowName: "Front desk",
    versionNumber: 2,
    entries: [
        {
            nodeKey: "answer",
            connectionId: "c-zalo",
            operation: "nivo.tool.customer.message.send",
            mode: "auto",
            asked: "auto",
            granted: true,
        },
    ],
})

const ATTACHED = [{ agentId: "agent-1", connectionId: "c-zalo", provider: "zalo_oa" }]

const build = async (options: { readonly known?: boolean } = {}) => {
    const members = mock<WorkspaceMembersService>()
    const rights = mock<AgentRightsStandingService>({
        standingOf: jest
            .fn()
            .mockResolvedValue([standingOf(), standingOf({ workflowId: "wf-9", agentId: "agent-2", entries: [] })]),
    })
    const offers = mock<ProviderOfferService>({ offerOf: jest.fn().mockResolvedValue(offerOf()) })
    const access = mock<AccountAttachmentsService>({
        listOfAgent: jest.fn().mockResolvedValue(ATTACHED),
        listOfWorkspace: jest.fn().mockResolvedValue(ATTACHED),
    })
    const bindings = mock<ConnectionBindingsReadService>({
        factsOf: jest.fn().mockResolvedValue([{ id: "c-zalo", name: "NIVO OA" }]),
        recordOf: jest.fn().mockResolvedValue(null),
    })
    const agents = mock<AgentDirectoryService>({
        identitiesOf: jest.fn().mockResolvedValue(options.known === false ? [] : [{ id: "agent-1", name: "Chatbot" }]),
    })
    const triggers = mock<ProviderTriggerStatesService>({ statesOf: jest.fn().mockResolvedValue([]) })
    const templates = mock<AgentWorkflowsAdminService>()
    const titles = mock<AgentStepTitlesService>({ titleOf: jest.fn().mockReturnValue(null) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            NodeRightRollupsService,
            { provide: WorkspaceMembersService, useValue: members },
            { provide: AgentRightsStandingService, useValue: rights },
            { provide: ProviderOfferService, useValue: offers },
            { provide: AccountAttachmentsService, useValue: access },
            { provide: ConnectionBindingsReadService, useValue: bindings },
            { provide: AgentDirectoryService, useValue: agents },
            { provide: ProviderTriggerStatesService, useValue: triggers },
            { provide: AgentWorkflowsAdminService, useValue: templates },
            { provide: AgentStepTitlesService, useValue: titles },
        ],
    }).compile()
    return {
        service: moduleRef.get(NodeRightRollupsService),
        members,
        rights,
        offers,
        access,
        bindings,
        agents,
        triggers,
        templates,
        titles,
    }
}

describe("NodeRightRollupsService.agentRights", () => {
    it("answers the page of the agent for any member: its accounts, and its rows only", async () => {
        const { service, members, offers } = await build()

        const page = await service.agentRights(ACTOR, "agent-1")

        expect(members.require).toHaveBeenCalledWith("user-1", "ws-1")
        expect(page.accounts).toEqual([
            {
                connectionId: "c-zalo",
                provider: "zalo_oa",
                kind: "messaging",
                name: "NIVO OA",
                stepsUsing: 1,
                operations: [],
            },
        ])
        expect(page.rows.map((row) => [row.workflowId, row.nodeKey, row.step, row.mode])).toEqual([
            ["wf-1", "answer", "chatbot.answer", "auto"],
        ])
        expect(offers.offerOf).toHaveBeenCalledWith(ACTOR, "c-zalo")
    })

    it("refuses a person who is no member before anything is read, and an agent the workspace does not hold", async () => {
        const stranger = await build()
        // Whatever the members capability refuses with passes through unchanged; its own error stands in for it here.
        const refusal = new NodeRightRollupsError({
            code: NodeRightRollupsErrorCode.AgentNotFound,
            params: { stand: "in" },
        })
        stranger.members.require.mockRejectedValue(refusal)
        const unknown = await build({ known: false })

        await expect(stranger.service.agentRights(ACTOR, "agent-1")).rejects.toBe(refusal)
        expect(stranger.rights.standingOf).not.toHaveBeenCalled()
        await expect(unknown.service.agentRights(ACTOR, "agent-x")).rejects.toMatchObject({
            code: NodeRightRollupsErrorCode.AgentNotFound,
        })
    })
})

describe("NodeRightRollupsService.providerHolders", () => {
    it("answers the tab of the account through the offer (which proves the member and the account), with the holders of every agent", async () => {
        const { service, offers, agents, triggers } = await build()
        offers.offerOf.mockResolvedValue(
            offerOf({
                mcp: [
                    {
                        id: "nivo.tool.customer.message.send",
                        kind: "write",
                        effect: null,
                        title: null,
                        summary: null,
                        description: null,
                        parameters: [],
                        returns: [],
                        operation: null,
                    },
                ],
            }),
        )

        const tab = await service.providerHolders(ACTOR, "c-zalo")

        expect(offers.offerOf).toHaveBeenCalledWith(ACTOR, "c-zalo")
        expect(
            tab.tools.map((row) => [row.operation.id, row.open, row.holders.map((holder) => holder.agentName)]),
        ).toEqual([["nivo.tool.customer.message.send", true, ["Chatbot"]]])
        expect(tab.counts).toEqual({ all: 1, held: 1, unheld: 0, writes: 1 })
        expect(agents.identitiesOf).toHaveBeenCalledWith("ws-1", ["agent-1", "agent-2"])
        expect(triggers.statesOf).toHaveBeenCalledWith(ACTOR, "c-zalo")
    })
})

describe("NodeRightRollupsService: a template's requests", () => {
    it("answers what a template version asks for through the template door, the newest version when none is named", async () => {
        const { service, templates } = await build()
        const wire = mock<TemplateWire>({ id: "sales.consult", moduleKey: "sales", latestVersion: CONSULT_NEWEST })
        templates.template.mockResolvedValue(wire)

        const newest = await service.templateRequests(ACTOR, "sales.consult", null)
        const named = await service.templateRequests(ACTOR, "sales.consult", CONSULT_NEWEST)

        expect(templates.template).toHaveBeenCalledWith(ACTOR, { templateId: "sales.consult" })
        // The newest consult graph, rolled up: the same answer the policy gives for that graph.
        const graph = INSTALLED.templateOf("sales.consult")?.versions.find((entry) => entry.version === CONSULT_NEWEST)?.graph
        if (graph === undefined) throw new TestWorldError({ code: TestWorldErrorCode.RowMissing, params: { what: "no consult graph" } })
        expect(newest).toEqual(templateRequestsOf("sales.consult", CONSULT_NEWEST, graph))
        // The rows of this graph are whatever the policy derives (compared above); no row is pinned here by name.
        expect([newest.version, newest.count]).toEqual([CONSULT_NEWEST, newest.rights.length])
        expect(named).toEqual(newest)
        await expect(service.templateRequests(ACTOR, "sales.consult", 99)).rejects.toMatchObject({
            code: NodeRightRollupsErrorCode.TemplateVersionNotFound,
        })
    })
})

describe("NodeRightRollupsService: the titles of the steps", () => {
    it("names the step of a row and of a holder with what the titles of the installed nodes answer for its step id", async () => {
        const { service, titles, offers } = await build()
        const title = { vi: "Tra loi khach", en: "Answer the customer" }
        titles.titleOf.mockReturnValue(title)
        const tool = mock<ProviderOffer["mcp"][number]>({
            id: "nivo.tool.customer.message.send",
            kind: "write",
            operation: null,
        })
        offers.offerOf.mockResolvedValue(offerOf({ mcp: [tool] }))

        const page = await service.agentRights(ACTOR, "agent-1")
        const tab = await service.providerHolders(ACTOR, "c-zalo")

        expect(page.rows.map((row) => row.stepTitle)).toEqual([title])
        expect(tab.tools[0]?.holders.map((holder) => holder.stepTitle)).toEqual([title])
        expect(titles.titleOf).toHaveBeenCalledWith("chatbot.answer")
    })
})
