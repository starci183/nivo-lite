import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { BranchCardPayload, CardRecord } from "@modules/domain/module-setup-writes"
import { ModulesErrorCode } from "./errors/modules.error"
import { SETUP_GRAPH } from "./modules.decorators"
import type { SetupGraphPort } from "./modules.port"
import { SetupBranchCardsService } from "./setup-branch-cards.service"
import type { ConfirmBranch } from "./setup-branch-cards.service"
import { SetupGraphService } from "./setup-graph.service"
import type { ProposedBranch } from "./policies/setup-writes.policy"

const PAYLOAD: BranchCardPayload = {
    action: "issue_invoice",
    boundaryVnd: 5_000_000,
    belongsTo: null,
    approverName: "Mr Nam",
    approverMemberId: null,
    quote: "above 5 million ask Nam",
}
const WRITE: ProposedBranch = { gateKey: "g1", kind: "branch", payload: PAYLOAD }

const build = async (options: { seat?: string | null; graph?: boolean } = {}) => {
    const graph = mock<SetupGraphPort>({ applyBranch: jest.fn().mockResolvedValue(undefined) })
    const seats = mock<SetupGraphService>({ seatNamed: jest.fn().mockResolvedValue(options.seat ?? null) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            SetupBranchCardsService,
            { provide: SetupGraphService, useValue: seats },
            ...(options.graph === false ? [] : [{ provide: SETUP_GRAPH, useValue: graph }]),
        ],
    }).compile()
    return { service: moduleRef.get(SetupBranchCardsService), graph, seats }
}

const closed: CardRecord = mock<CardRecord>({})

const confirmOf = (overrides: Partial<ConfirmBranch> = {}): ConfirmBranch => ({
    workspaceId: "ws-1",
    installationId: "inst-1",
    messageId: "msg-1",
    base: PAYLOAD,
    change: { decision: "confirm", belongsTo: "higher", approverMemberId: "nam" },
    close: jest.fn().mockResolvedValue(closed),
    ...overrides,
})

describe("SetupBranchCardsService.cardOf", () => {
    it("fills the seat of the person the owner named when it is found", async () => {
        const { service, seats } = await build({ seat: "nam" })

        const card = await service.cardOf("ws-1", WRITE)

        expect(seats.seatNamed).toHaveBeenCalledWith("ws-1", "Mr Nam")
        expect(card).toMatchObject({ kind: "branch", payload: { approverMemberId: "nam", approverName: "Mr Nam" } })
    })

    it("leaves the seat open when nobody is found, and keys the card by the action", async () => {
        const { service } = await build({ seat: null })

        await expect(service.cardOf("ws-1", WRITE)).resolves.toMatchObject({ payload: { approverMemberId: null } })
        expect(service.targetOf(WRITE)).toBe("branch:issue_invoice")
    })
})

describe("SetupBranchCardsService.confirm", () => {
    it("writes the branch into the graph with the band and person of the owner, and closes the card as applied", async () => {
        const { service, graph } = await build()
        const input = confirmOf()

        await expect(service.confirm(input)).resolves.toBe(closed)

        expect(graph.applyBranch).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            installationId: "inst-1",
            action: "issue_invoice",
            boundaryVnd: 5_000_000,
            belongsTo: "higher",
            approverMemberId: "nam",
            quote: "above 5 million ask Nam",
            messageId: "msg-1",
        })
        expect(input.close).toHaveBeenCalledWith(
            "applied",
            { ...PAYLOAD, belongsTo: "higher", approverMemberId: "nam" },
            { outcome: "applied" },
        )
    })

    it("takes the band and the person already on the card when the owner changed neither", async () => {
        const { service, graph } = await build()
        const base = { ...PAYLOAD, belongsTo: "lower" as const, approverMemberId: "dinh" }

        await service.confirm(confirmOf({ base, change: { decision: "confirm" } }))

        expect(graph.applyBranch).toHaveBeenCalledWith(expect.objectContaining({ belongsTo: "lower", approverMemberId: "dinh" }))
    })

    it.each([
        ["no band", { decision: "confirm" as const, approverMemberId: "nam" }],
        ["no person", { decision: "confirm" as const, belongsTo: "higher" as const }],
    ])("refuses a card with %s and writes nothing", async (_name, change) => {
        const { service, graph } = await build()
        const input = confirmOf({ change })

        await expect(service.confirm(input)).rejects.toMatchObject({ code: ModulesErrorCode.CardBranchIncomplete })
        expect(graph.applyBranch).not.toHaveBeenCalled()
        expect(input.close).not.toHaveBeenCalled()
    })

    it("refuses when the app has no graph to write into", async () => {
        const { service } = await build({ graph: false })

        await expect(service.confirm(confirmOf())).rejects.toMatchObject({ code: ModulesErrorCode.CardBranchIncomplete })
    })
})
