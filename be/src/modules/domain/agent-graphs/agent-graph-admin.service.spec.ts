import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { BrainFactsService } from "@modules/domain/brain-facts"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import { WorkspaceMemberSeatsService } from "@modules/domain/workspace-members"
import { OWNER_EXAMPLE, graphOf, stateOf } from "@tests/fixtures/builders/agent-graph.builder"
import { AgentGraphAdminService } from "./agent-graph-admin.service"
import { AgentGraphContextService } from "./agent-graph-context.service"
import { AgentGraphProposalsService } from "./agent-graph-proposals.service"
import { AgentGraphPublishService } from "./agent-graph-publish.service"
import { AgentGraphRunService } from "./agent-graph-run.service"
import { AgentGraphSeedService } from "./agent-graph-seed.service"
import { AgentGraphViewService } from "./agent-graph-view.service"
import { AgentGraphsError, AgentGraphsErrorCode } from "./errors/agent-graphs.error"
import { AgentGraphsService } from "./agent-graphs.service"
import type { GraphDocument, GraphSource } from "./agent-graphs.contracts"
import type { OptionalGraphState } from "./agent-graphs.service"

const ACTOR = { workspaceId: "ws-1", principalId: "user-1" }
const VIEW = { agentId: "agent-1" }
const VERSION = { id: "version-2" }

const build = async (
    options: {
        role?: "owner" | "manager" | "staff" | null
        state?: OptionalGraphState
        installed?: boolean
        patch?: {
            readonly signal: "trust" | "reject" | "timeout"
            readonly branchKey: string
            readonly amounts: ReadonlyArray<number>
        } | null
        conflict?: { readonly oldFactId: string; readonly newFactId: string; readonly newValueHash: string } | null
        brainValue?: string | null
    } = {},
) => {
    const role = options.role === undefined ? "manager" : options.role
    const seats = mock<WorkspaceMemberSeatsService>({
        activeSeatOfUser: jest
            .fn()
            .mockResolvedValue(
                role === null
                    ? null
                    : { memberId: "member-1", userId: "user-1", role, displayName: "An", status: "active" },
            ),
    })
    const graphs = mock<AgentGraphsService>({
        stateOfAgent: jest.fn().mockResolvedValue(options.state === undefined ? stateOf() : options.state),
        versionsOf: jest.fn().mockResolvedValue([VERSION]),
        saveDraft: jest.fn().mockResolvedValue({ draftRev: 5 }),
    })
    const seed = mock<AgentGraphSeedService>({ ensureFor: jest.fn().mockResolvedValue(stateOf()) })
    const view = mock<AgentGraphViewService>({ viewOf: jest.fn().mockResolvedValue(VIEW) })
    const publishing = mock<AgentGraphPublishService>({
        publishDraft: jest.fn().mockResolvedValue(VERSION),
        publishLearned: jest.fn().mockResolvedValue(VERSION),
        publishConflict: jest.fn().mockResolvedValue(VERSION),
        restore: jest.fn().mockResolvedValue(VERSION),
        setMode: jest.fn().mockResolvedValue(stateOf()),
    })
    const proposals = mock<AgentGraphProposalsService>({
        decline: jest.fn().mockResolvedValue(undefined),
        learnedOf: jest
            .fn()
            .mockResolvedValue(
                options.patch === undefined
                    ? { signal: "trust", branchKey: "middle", amounts: [7_200_000] }
                    : options.patch,
            ),
        conflictOf: jest.fn().mockResolvedValue(options.conflict ?? null),
        confirm: jest.fn().mockResolvedValue(undefined),
        supersede: jest.fn().mockResolvedValue(undefined),
    })
    const brain = mock<BrainFactsService>({
        get: jest
            .fn()
            .mockResolvedValue(options.brainValue === null ? null : { id: "fact-2", value: options.brainValue ?? "Under 10M" }),
    })
    const running = mock<AgentGraphRunService>({ runOf: jest.fn().mockResolvedValue({ decisionId: "decision-1" }) })
    const context = mock<AgentGraphContextService>({ coverageOf: jest.fn().mockResolvedValue([{ nodeKey: "decide" }]) })
    const installations = mock<InstallationRecordsService>({
        ofAgent: jest.fn().mockResolvedValue(options.installed === false ? null : { id: "inst-1" }),
        findById: jest
            .fn()
            .mockResolvedValue(options.installed === false ? null : { id: "inst-1", moduleKey: "accounting" }),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentGraphAdminService,
            { provide: WorkspaceMemberSeatsService, useValue: seats },
            { provide: AgentGraphsService, useValue: graphs },
            { provide: AgentGraphSeedService, useValue: seed },
            { provide: AgentGraphViewService, useValue: view },
            { provide: AgentGraphPublishService, useValue: publishing },
            { provide: AgentGraphProposalsService, useValue: proposals },
            { provide: InstallationRecordsService, useValue: installations },
            { provide: AgentGraphRunService, useValue: running },
            { provide: AgentGraphContextService, useValue: context },
            { provide: BrainFactsService, useValue: brain },
        ],
    }).compile()
    return {
        service: moduleRef.get(AgentGraphAdminService),
        graphs,
        seed,
        view,
        publishing,
        proposals,
        running,
        context,
        brain,
    }
}

describe("AgentGraphAdminService access", () => {
    it.each([["staff" as const], [null]])("refuses a seat that is %s, whatever the call", async (role) => {
        const { service } = await build({ role })

        await expect(service.open(ACTOR, "agent-1", "vi")).rejects.toEqual(
            expect.objectContaining({ code: AgentGraphsErrorCode.Forbidden }),
        )
        await expect(service.versions(ACTOR, "agent-1")).rejects.toBeInstanceOf(AgentGraphsError)
        await expect(service.saveDraft(ACTOR, "agent-1", 1, "{}")).rejects.toBeInstanceOf(AgentGraphsError)
        await expect(service.publish(ACTOR, "agent-1", "")).rejects.toBeInstanceOf(AgentGraphsError)
        await expect(service.restore(ACTOR, "agent-1", "v")).rejects.toBeInstanceOf(AgentGraphsError)
        await expect(service.setMode(ACTOR, "agent-1", "shadow")).rejects.toBeInstanceOf(AgentGraphsError)
        await expect(service.decline(ACTOR, "agent-1", "p")).rejects.toBeInstanceOf(AgentGraphsError)
        await expect(service.confirm(ACTOR, "agent-1", "p")).rejects.toBeInstanceOf(AgentGraphsError)
        await expect(service.run(ACTOR, "item")).rejects.toBeInstanceOf(AgentGraphsError)
        await expect(service.coverage(ACTOR, "agent-1")).rejects.toBeInstanceOf(AgentGraphsError)
    })
})

describe("AgentGraphAdminService.open", () => {
    it("opens a graph that exists without seeding it", async () => {
        const { service, seed, view } = await build()

        await expect(service.open(ACTOR, "agent-1", "en")).resolves.toMatchObject({ agentId: "agent-1" })

        expect(seed.ensureFor).not.toHaveBeenCalled()
        expect(view.viewOf).toHaveBeenCalledWith("ws-1", "agent-1", "en")
    })

    it("seeds the graph of the installation on the first open", async () => {
        const { service, seed } = await build({ state: null })

        await service.open(ACTOR, "agent-1", "vi")

        expect(seed.ensureFor).toHaveBeenCalledWith("inst-1", "vi")
    })

    it("seeds nothing for an agent that has no installation", async () => {
        const { service, seed } = await build({ state: null, installed: false })

        await service.open(ACTOR, "agent-1", "vi")

        expect(seed.ensureFor).not.toHaveBeenCalled()
    })
})

describe("AgentGraphAdminService changes", () => {
    it("lists the versions and saves a draft read from JSON text, answering the new revision", async () => {
        const { service, graphs } = await build()

        await expect(service.versions(ACTOR, "agent-1")).resolves.toEqual([VERSION])
        await expect(service.saveDraft(ACTOR, "agent-1", 4, '{"nodes":[],"rights":[]}')).resolves.toBe(5)
        await expect(service.saveDraft(ACTOR, "agent-1", 4, "not json")).rejects.toEqual(
            expect.objectContaining({ code: AgentGraphsErrorCode.DocumentInvalid }),
        )

        expect(graphs.saveDraft.mock.calls).toEqual([["ws-1", "agent-1", 4, { nodes: [], rights: [] }]])
    })

    it("publishes and restores as the seat that asked, with the role it holds", async () => {
        const { service, publishing } = await build({ role: "owner" })

        await expect(service.publish(ACTOR, "agent-1", "Raised")).resolves.toBe(VERSION)
        await expect(service.restore(ACTOR, "agent-1", "version-1")).resolves.toBe(VERSION)

        expect(publishing.publishDraft).toHaveBeenCalledWith(
            "ws-1",
            "agent-1",
            { memberId: "member-1", role: "owner" },
            "Raised",
        )
        expect(publishing.restore).toHaveBeenCalledWith("ws-1", "agent-1", "version-1", {
            memberId: "member-1",
            role: "owner",
        })
    })

    it("sets the mode and declines a proposal as the seat that asked", async () => {
        const { service, publishing, proposals } = await build()

        await service.setMode(ACTOR, "agent-1", "shadow")
        await service.decline(ACTOR, "agent-1", "p1")

        expect(publishing.setMode).toHaveBeenCalledWith("ws-1", "agent-1", "shadow", {
            memberId: "member-1",
            role: "manager",
        })
        expect(proposals.decline).toHaveBeenCalledWith("ws-1", "agent-1", "p1", "member-1")
    })
})

describe("AgentGraphAdminService.confirm", () => {
    it("makes the change the proposal proposes to the graph that decides and publishes it as the seat that asked", async () => {
        const { service, publishing, proposals } = await build({ role: "owner" })

        await expect(service.confirm(ACTOR, "agent-1", "p1")).resolves.toBe(VERSION)

        const [, , document, by] = publishing.publishLearned.mock.calls[0] ?? []
        expect(by).toEqual({ memberId: "member-1", role: "owner" })
        expect(document?.nodes.find((node) => node.decide !== undefined)?.decide?.branches[0]?.when).toEqual({
            fact: "supplier_payment.amount_vnd",
            op: "lt",
            value: 8_000_000,
        })
        expect(proposals.confirm).toHaveBeenCalledWith("ws-1", "agent-1", "p1", "member-1", "version-2")
    })

    it("overtakes a proposal whose change no longer applies, and publishes nothing", async () => {
        const { service, publishing, proposals } = await build({
            patch: { signal: "trust", branchKey: "gone", amounts: [9_000_000] },
        })

        await expect(service.confirm(ACTOR, "agent-1", "p1")).rejects.toEqual(
            expect.objectContaining({ code: AgentGraphsErrorCode.ProposalNotFound }),
        )

        expect(proposals.supersede).toHaveBeenCalledWith("ws-1", "agent-1", "p1")
        expect(publishing.publishLearned).not.toHaveBeenCalled()
    })

    it("refuses a proposal that is not open and a graph with no version that decides", async () => {
        const closed = await build({ patch: null })
        const fresh = await build({ state: stateOf({ active: null, activeVersionId: null }) })

        await expect(closed.service.confirm(ACTOR, "agent-1", "p1")).rejects.toEqual(
            expect.objectContaining({ code: AgentGraphsErrorCode.ProposalNotFound }),
        )
        await expect(fresh.service.confirm(ACTOR, "agent-1", "p1")).rejects.toBeInstanceOf(AgentGraphsError)
        expect(closed.publishing.publishLearned).not.toHaveBeenCalled()
    })
})

describe("AgentGraphAdminService.confirm of a Brain conflict", () => {
    const CONFLICT = { oldFactId: "fact-1", newFactId: "fact-2", newValueHash: "hash-2" }
    const BRAIN: GraphSource = { kind: "brain", factId: "fact-1", passage: "Under 5M", valueHash: "hash-1" }
    const citing = (): GraphDocument => {
        const base = graphOf(OWNER_EXAMPLE)
        return {
            ...base,
            nodes: base.nodes.map((node) =>
                node.decide === undefined
                    ? node
                    : {
                          ...node,
                          decide: {
                              ...node.decide,
                              branches: node.decide.branches.map((branch) =>
                                  branch.key === "small" ? { ...branch, sources: [BRAIN] } : branch,
                              ),
                          },
                      },
            ),
        }
    }
    const CITING = stateOf({ active: citing(), draft: citing() })

    it("swaps the rule the running graph cites for the rule in force and publishes it as a conflict version", async () => {
        const { service, publishing, proposals } = await build({ role: "owner", conflict: CONFLICT, state: CITING })

        await expect(service.confirm(ACTOR, "agent-1", "p1")).resolves.toBe(VERSION)

        const [, , document, by] = publishing.publishConflict.mock.calls[0] ?? []
        expect(by).toEqual({ memberId: "member-1", role: "owner" })
        expect(JSON.stringify(document)).toContain("Under 10M")
        expect(JSON.stringify(document)).not.toContain("fact-1")
        expect(publishing.publishLearned).not.toHaveBeenCalled()
        expect(proposals.confirm).toHaveBeenCalledWith("ws-1", "agent-1", "p1", "member-1", "version-2")
    })

    it("overtakes a conflict whose rule no graph cites any more, and publishes nothing", async () => {
        const { service, publishing, proposals } = await build({ conflict: CONFLICT })

        await expect(service.confirm(ACTOR, "agent-1", "p1")).rejects.toEqual(
            expect.objectContaining({ code: AgentGraphsErrorCode.ProposalNotFound }),
        )

        expect(proposals.supersede).toHaveBeenCalledWith("ws-1", "agent-1", "p1")
        expect(publishing.publishConflict).not.toHaveBeenCalled()
    })

    it("overtakes a conflict whose new rule is gone from the Brain", async () => {
        const { service, publishing, proposals } = await build({ conflict: CONFLICT, state: CITING, brainValue: null })

        await expect(service.confirm(ACTOR, "agent-1", "p1")).rejects.toBeInstanceOf(AgentGraphsError)

        expect(proposals.supersede).toHaveBeenCalled()
        expect(publishing.publishConflict).not.toHaveBeenCalled()
    })
})

describe("AgentGraphAdminService the run and the coverage", () => {
    it("reads the trace of a run for a seat that may see the graph", async () => {
        const { service, running } = await build()

        await expect(service.run(ACTOR, "item-9")).resolves.toEqual({ decisionId: "decision-1" })
        expect(running.runOf).toHaveBeenCalledWith("ws-1", "item-9")
    })

    it("reads who can answer each ask of the draft graph", async () => {
        const { service, context } = await build()

        await expect(service.coverage(ACTOR, "agent-1")).resolves.toEqual([{ nodeKey: "decide" }])
        expect(context.coverageOf).toHaveBeenCalledWith(
            expect.objectContaining({ agentId: "agent-1", moduleKey: "accounting" }),
            stateOf().draft,
        )
    })

    it("refuses the coverage of an agent with no graph or no installation", async () => {
        const none = await build({ state: null })
        const gone = await build({ installed: false })

        await expect(none.service.coverage(ACTOR, "agent-1")).rejects.toEqual(
            expect.objectContaining({ code: AgentGraphsErrorCode.GraphNotFound }),
        )
        await expect(gone.service.coverage(ACTOR, "agent-1")).rejects.toBeInstanceOf(AgentGraphsError)
    })
})
