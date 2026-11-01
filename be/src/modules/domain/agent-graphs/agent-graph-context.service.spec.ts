import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AuthorityRulesService } from "@modules/domain/authority-rules"
import { McpGatewayService } from "@modules/domain/mcp-gateway"
import { MemberGrantsService } from "@modules/domain/member-grants"
import type { DirectoryMember, MemberGrant } from "@modules/domain/member-grants"
import { ModulesService } from "@modules/domain/modules"
import { AMOUNT_FACT, FACTS, graphOf, OWNER_EXAMPLE } from "@tests/fixtures/builders/agent-graph.builder"
import { AgentGraphContextService } from "./agent-graph-context.service"
import { GraphFactsService } from "./graph-facts.service"

const SCOPE = { workspaceId: "ws-1", agentId: "agent-1", installationId: "inst-1", moduleKey: "accounting" }
const DOCUMENT = graphOf(OWNER_EXAMPLE)

const member = (
    memberId: string,
    role: DirectoryMember["role"],
    status: DirectoryMember["status"] = "active",
): DirectoryMember => ({
    memberId,
    name: memberId,
    role,
    roomId: null,
    status,
    rooms: [],
})

const grant = (memberId: string, maxAmount: number | null): MemberGrant => ({
    id: `grant-${memberId}`,
    workspace_id: "ws-1",
    member_id: memberId,
    action: "pay_supplier",
    unit: "vnd",
    max_amount: maxAmount,
    updated_at: "2026-11-01T00:00:00.000Z",
})

const build = async (options: { audience?: "customer" | "internal"; rule?: "none"; unlisted?: true } = {}) => {
    const facts = mock<GraphFactsService>({ registry: jest.fn().mockReturnValue(FACTS) })
    const rules = mock<AuthorityRulesService>({
        ownerRuleFor: jest.fn().mockResolvedValue(
            options.rule === "none"
                ? null
                : {
                      id: "r",
                      department: "accounting",
                      action: "pay_supplier",
                      mode: "auto",
                      limit_vnd: 5_000_000,
                      required_fields: [],
                      auto_max: 20_000_000,
                  },
        ),
    })
    const gateway = mock<McpGatewayService>({
        grantsOf: jest.fn().mockResolvedValue([
            { tool: "sepay.status", mode: "auto", limitVnd: null, constraints: [] },
            { tool: "brain.*", mode: "ask", limitVnd: null, constraints: [] },
            { tool: "drive.search", mode: "never", limitVnd: null, constraints: [] },
        ]),
    })
    const members = mock<MemberGrantsService>({
        directory: jest
            .fn()
            .mockResolvedValue([
                member("boss", "owner"),
                member("dinh", "manager"),
                member("nam", "staff"),
                member("gone", "manager", "disabled"),
            ]),
        forAction: jest.fn().mockResolvedValue([grant("dinh", 20_000_000)]),
    })
    const modules = mock<ModulesService>({
        find: jest.fn().mockResolvedValue({
            audience: options.audience ?? "internal",
            authorityActions:
                options.unlisted === true
                    ? []
                    : [
                          { action: "pay_supplier", maxMode: "ask" },
                          { action: "other", maxMode: null },
                      ],
        }),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentGraphContextService,
            { provide: GraphFactsService, useValue: facts },
            { provide: AuthorityRulesService, useValue: rules },
            { provide: McpGatewayService, useValue: gateway },
            { provide: MemberGrantsService, useValue: members },
            { provide: ModulesService, useValue: modules },
        ],
    }).compile()
    return { service: moduleRef.get(AgentGraphContextService), rules, gateway, members, modules }
}

describe("AgentGraphContextService.contextOf ceilings and facts", () => {
    it("reads the ceiling of each action the graph decides, with the cap of the registry", async () => {
        const { service, rules, modules } = await build()

        const context = await service.contextOf(SCOPE, DOCUMENT)

        expect(context.facts).toBe(FACTS)
        expect(context.ceilings).toEqual([
            { action: "pay_supplier", mode: "auto", limitVnd: 5_000_000, autoMax: 20_000_000, maxMode: "ask" },
        ])
        expect(rules.ownerRuleFor).toHaveBeenCalledWith(SCOPE, "pay_supplier", "agent-1")
        expect(modules.find).toHaveBeenCalledWith("accounting")
    })

    it("reads an action with no rule as one that never runs", async () => {
        const { service } = await build({ rule: "none" })

        const context = await service.contextOf(SCOPE, DOCUMENT)

        expect(context.ceilings).toEqual([
            { action: "pay_supplier", mode: "never", limitVnd: null, autoMax: null, maxMode: "ask" },
        ])
    })

    it("puts no cap on an action the module catalogue does not list", async () => {
        const { service } = await build({ unlisted: true })

        const context = await service.contextOf(SCOPE, DOCUMENT)

        expect(context.ceilings).toEqual([
            { action: "pay_supplier", mode: "auto", limitVnd: 5_000_000, autoMax: 20_000_000, maxMode: null },
        ])
    })

    it("reads no rule for a graph that decides nothing, and reports whether the agent faces customers", async () => {
        const internal = await build()
        const outward = await build({ audience: "customer" })

        const quiet = await internal.service.contextOf(SCOPE, { nodes: [], rights: [] })

        expect(quiet.ceilings).toEqual([])
        expect(quiet.facesCustomers).toBe(false)
        expect((await outward.service.contextOf(SCOPE, DOCUMENT)).facesCustomers).toBe(true)
    })
})

describe("AgentGraphContextService.contextOf grants and approvers", () => {
    it("grants a tool by its name or its connector wildcard, and not a tool the grant forbids", async () => {
        const { service } = await build()

        const context = await service.contextOf(SCOPE, DOCUMENT)

        expect(context.isGranted("sepay.status")).toBe(true)
        expect(context.isGranted("brain.facts.list")).toBe(true)
        expect(context.isGranted("drive.search")).toBe(false)
        expect(context.isGranted("zalo.send")).toBe(false)
    })

    it("covers an amount with the owner or a member whose grant reaches it, and no one else", async () => {
        const { service, members } = await build()

        const context = await service.contextOf(SCOPE, DOCUMENT)

        expect(context.approverCovers("pay_supplier", { roles: [], rooms: [], members: ["dinh"] }, 20_000_000)).toBe(
            true,
        )
        expect(context.approverCovers("pay_supplier", { roles: [], rooms: [], members: ["dinh"] }, 25_000_000)).toBe(
            false,
        )
        expect(context.approverCovers("pay_supplier", { roles: [], rooms: [], members: ["dinh"] }, null)).toBe(true)
        expect(context.approverCovers("pay_supplier", { roles: ["owner"], rooms: [], members: [] }, 90_000_000)).toBe(
            true,
        )
        expect(context.approverCovers("pay_supplier", { roles: [], rooms: [], members: ["nam"] }, 1)).toBe(false)
        expect(context.approverCovers("unseen", { roles: [], rooms: [], members: ["dinh"] }, 1)).toBe(false)
        expect(members.forAction).toHaveBeenCalledWith("ws-1", "pay_supplier")
    })

    it("holds a group present while one of its seats is active, with a grant or without one, and absent when all are disabled", async () => {
        const { service } = await build()

        const context = await service.contextOf(SCOPE, DOCUMENT)

        expect(context.groupHasPeople({ roles: [], rooms: [], members: ["nam"] })).toBe(true)
        expect(context.groupHasPeople({ roles: [], rooms: [], members: ["dinh"] })).toBe(true)
        expect(context.groupHasPeople({ roles: [], rooms: [], members: ["gone"] })).toBe(false)
        expect(context.groupHasPeople({ roles: [], rooms: [], members: [] })).toBe(false)
        expect(AMOUNT_FACT).toBeDefined()
    })
})

describe("AgentGraphContextService.coverageOf", () => {
    it("says who a request would go to for each ask, up to the top of the branch, and who was left out and why", async () => {
        const { service } = await build()

        const coverage = await service.coverageOf(SCOPE, DOCUMENT)

        expect(coverage).toEqual([
            {
                nodeKey: "decide",
                branchKey: "middle",
                top: 20_000_000,
                approvers: ["dinh"],
                excluded: [{ name: "gone", reason: "inactive" }],
                covered: true,
            },
            {
                nodeKey: "decide",
                branchKey: "else",
                top: null,
                approvers: [],
                excluded: [{ name: "nam", reason: "no_grant" }],
                covered: false,
            },
            {
                nodeKey: "ask",
                branchKey: null,
                top: null,
                approvers: ["dinh"],
                excluded: [{ name: "gone", reason: "inactive" }],
                covered: true,
            },
        ])
    })

    it("has nobody to name when the directory is empty, and nothing to say about a graph that asks nobody", async () => {
        const { service, members } = await build()
        members.directory.mockResolvedValue([])

        const lost = await service.coverageOf(SCOPE, DOCUMENT)

        expect(lost.every((entry) => entry.approvers.length === 0 && entry.excluded.length === 0)).toBe(true)
        await expect(service.coverageOf(SCOPE, { nodes: [], rights: [] })).resolves.toEqual([])
    })
})
