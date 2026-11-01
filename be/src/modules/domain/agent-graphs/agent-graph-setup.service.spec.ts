import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { MemberGrantsService } from "@modules/domain/member-grants"
import type { DirectoryMember } from "@modules/domain/member-grants"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import { WorkspaceMemberSeatsService } from "@modules/domain/workspace-members"
import {
    OWNER_EXAMPLE,
    amountIs,
    approverOf,
    branchOf,
    contextOf,
    graphOf,
    stateOf,
} from "@tests/fixtures/builders/agent-graph.builder"
import { AgentGraphContextService } from "./agent-graph-context.service"
import { AgentGraphPublishService } from "./agent-graph-publish.service"
import { AgentGraphSeedService } from "./agent-graph-seed.service"
import { AgentGraphSetupService } from "./agent-graph-setup.service"
import { AgentGraphsError, AgentGraphsErrorCode } from "./errors/agent-graphs.error"
import { AgentGraphsService } from "./agent-graphs.service"
import type { OptionalGraphState } from "./agent-graphs.service"

const person = (memberId: string, name: string, status: "active" | "disabled" = "active"): DirectoryMember => ({
    memberId,
    name,
    role: "manager",
    roomId: null,
    status,
    rooms: [],
})

const CHANGE = {
    workspaceId: "ws-1",
    installationId: "inst-1",
    action: "pay_supplier",
    boundaryVnd: 8_000_000,
    belongsTo: "higher" as const,
    approverMemberId: "nam",
    quote: "above 8 million Nam",
    messageId: "msg-1",
}
const APPLICANT = { workspaceId: "ws-1", principalId: "user-1", installationId: "inst-1" }
const APPLIER = { ...APPLICANT, version: 8, contextVersionId: "cv-1" }

interface Options {
    readonly state?: OptionalGraphState
    readonly seeded?: OptionalGraphState
    readonly people?: ReadonlyArray<DirectoryMember>
    readonly seat?: boolean
}

const build = async (options: Options = {}) => {
    const graphs = mock<AgentGraphsService>({
        stateOfInstallation: jest.fn().mockResolvedValue(options.state === undefined ? stateOf() : options.state),
        saveDraft: jest.fn().mockResolvedValue(undefined),
        latestVersionOf: jest.fn().mockResolvedValue(7),
    })
    const seed = mock<AgentGraphSeedService>({ ensureFor: jest.fn().mockResolvedValue(options.seeded ?? null) })
    const installations = mock<InstallationRecordsService>({
        findById: jest.fn().mockResolvedValue({ id: "inst-1", moduleKey: "accounting" }),
    })
    const context = mock<AgentGraphContextService>({ contextOf: jest.fn().mockResolvedValue(contextOf()) })
    const publishing = mock<AgentGraphPublishService>({
        publishDraft: jest.fn().mockResolvedValue(undefined),
        requirePublishable: jest.fn().mockResolvedValue(undefined),
    })
    const members = mock<MemberGrantsService>({ directory: jest.fn().mockResolvedValue(options.people ?? []) })
    const seats = mock<WorkspaceMemberSeatsService>({
        activeSeatOfUser: jest
            .fn()
            .mockResolvedValue(options.seat === false ? null : { memberId: "boss", role: "owner" }),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentGraphSetupService,
            { provide: AgentGraphsService, useValue: graphs },
            { provide: AgentGraphSeedService, useValue: seed },
            { provide: InstallationRecordsService, useValue: installations },
            { provide: AgentGraphContextService, useValue: context },
            { provide: AgentGraphPublishService, useValue: publishing },
            { provide: MemberGrantsService, useValue: members },
            { provide: WorkspaceMemberSeatsService, useValue: seats },
        ],
    }).compile()
    return { service: moduleRef.get(AgentGraphSetupService), graphs, seed, publishing }
}

describe("AgentGraphSetupService.applyBranch", () => {
    it("saves the draft with the line moved, at the revision it read", async () => {
        const { service, graphs } = await build({ state: stateOf({ draftRev: 4 }) })

        await service.applyBranch(CHANGE)

        expect(graphs.saveDraft).toHaveBeenCalledWith("ws-1", "agent-1", 4, expect.anything())
        expect(JSON.stringify(jest.mocked(graphs.saveDraft).mock.calls[0]?.[3])).toContain("8000000")
    })

    it("sources the line to the chat itself when the message has no id", async () => {
        const { service, graphs } = await build()

        await service.applyBranch({ ...CHANGE, messageId: null })

        expect(JSON.stringify(jest.mocked(graphs.saveDraft).mock.calls[0]?.[3])).toContain('"messageId":"setup"')
    })

    it("opens the graph first when the installation has none yet", async () => {
        const { service, seed, graphs } = await build({ state: null, seeded: stateOf() })

        await service.applyBranch(CHANGE)

        expect(seed.ensureFor).toHaveBeenCalledWith("inst-1", "vi")
        expect(graphs.saveDraft).toHaveBeenCalled()
    })

    it("refuses a graph that cannot be opened or belongs to another workspace, and an action with no bands", async () => {
        const none = await build({ state: null, seeded: null })
        const other = await build({ state: stateOf({ workspaceId: "ws-2" }) })
        const lone = graphOf([branchOf({ key: "all", when: amountIs("lt", 1), then: "auto", next: "act" })])
        const bare = await build({ state: stateOf({ draft: lone }) })

        await expect(none.service.applyBranch(CHANGE)).rejects.toMatchObject({
            code: AgentGraphsErrorCode.GraphNotFound,
        })
        await expect(other.service.applyBranch(CHANGE)).rejects.toMatchObject({
            code: AgentGraphsErrorCode.GraphNotFound,
        })
        await expect(bare.service.applyBranch(CHANGE)).rejects.toMatchObject({
            code: AgentGraphsErrorCode.BranchNotApplicable,
        })
    })
})

describe("AgentGraphSetupService.firstGap", () => {
    it("names the first vague place of the draft, or nothing when it is whole", async () => {
        const open = OWNER_EXAMPLE.map((branch) =>
            branch.key === "middle" ? { ...branch, approver: approverOf({ onTimeout: { kind: "unset" } }) } : branch,
        )
        const vague = await build({ state: stateOf({ draft: graphOf(open) }) })
        const whole = await build()

        await expect(vague.service.firstGap("ws-1", "inst-1")).resolves.not.toBe("")
        await expect(whole.service.firstGap("ws-1", "inst-1")).resolves.toBe("")
    })

    it("names nothing for an installation with no graph or one of another workspace", async () => {
        const none = await build({ state: null })
        const other = await build({ state: stateOf({ workspaceId: "ws-2" }) })

        await expect(none.service.firstGap("ws-1", "inst-1")).resolves.toBe("")
        await expect(other.service.firstGap("ws-1", "inst-1")).resolves.toBe("")
    })
})

describe("AgentGraphSetupService.seatNamed", () => {
    it("finds the one active person that answers to the name, whatever the case or spacing", async () => {
        const { service } = await build({ people: [person("nam", "Nguyen Nam"), person("dinh", "Dinh")] })

        await expect(service.seatNamed("ws-1", "nguyen  NAM")).resolves.toBe("nam")
    })

    it("finds nobody when no one, a disabled one, or two people answer to the name", async () => {
        const { service } = await build({
            people: [person("a", "Nam"), person("b", "Nam"), person("c", "Dinh", "disabled")],
        })

        await expect(service.seatNamed("ws-1", "Nam")).resolves.toBe("")
        await expect(service.seatNamed("ws-1", "Dinh")).resolves.toBe("")
        await expect(service.seatNamed("ws-1", "Lan")).resolves.toBe("")
    })
})

describe("AgentGraphSetupService.publish", () => {
    it("publishes under the seat that applies, with the context version and the number the setup became", async () => {
        const active = graphOf([branchOf({ key: "else", when: "else", then: "ask", next: "ask" })])
        const { service, publishing } = await build({ state: stateOf({ active }) })

        await service.publish(APPLIER)

        expect(publishing.publishDraft).toHaveBeenCalledWith(
            "ws-1",
            "agent-1",
            { memberId: "boss", role: "owner" },
            "",
            "chat",
            "cv-1",
            8,
        )
    })

    it("publishes a draft that did not change from the active graph too, so the version and the mode move", async () => {
        const { service, publishing } = await build()

        await service.publish(APPLIER)

        expect(publishing.publishDraft).toHaveBeenCalledTimes(1)
    })

    it("publishes nothing with no graph, or for an account with no active seat", async () => {
        const none = await build({ state: null })
        const seatless = await build({ state: stateOf({ active: null }), seat: false })

        await none.service.publish(APPLIER)
        await seatless.service.publish(APPLIER)

        expect(none.publishing.publishDraft).not.toHaveBeenCalled()
        expect(seatless.publishing.publishDraft).not.toHaveBeenCalled()
    })
})

describe("AgentGraphSetupService.checkPublish", () => {
    it("checks the draft under the seat that applies and answers the newest graph version", async () => {
        const { service, publishing, graphs } = await build()

        await expect(service.checkPublish(APPLICANT)).resolves.toBe(7)

        expect(publishing.requirePublishable).toHaveBeenCalledWith("ws-1", "agent-1", {
            memberId: "boss",
            role: "owner",
        })
        expect(graphs.latestVersionOf).toHaveBeenCalledWith("ws-1", "agent-1")
    })

    it("lets the refusal of the publish through, writing nothing", async () => {
        const { service, publishing } = await build()
        publishing.requirePublishable.mockRejectedValue(
            new AgentGraphsError({ code: AgentGraphsErrorCode.WidensNeedsOwner }),
        )

        await expect(service.checkPublish(APPLICANT)).rejects.toMatchObject({
            code: AgentGraphsErrorCode.WidensNeedsOwner,
        })
        expect(publishing.publishDraft).not.toHaveBeenCalled()
    })

    it("answers 0 with no graph, and the newest version without a check for an account with no seat", async () => {
        const none = await build({ state: null })
        const seatless = await build({ seat: false })

        await expect(none.service.checkPublish(APPLICANT)).resolves.toBe(0)
        await expect(seatless.service.checkPublish(APPLICANT)).resolves.toBe(7)
        expect(seatless.publishing.requirePublishable).not.toHaveBeenCalled()
    })
})
