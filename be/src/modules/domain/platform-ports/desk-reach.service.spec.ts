import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AgentAccountsService } from "@modules/domain/tools"
import { WorkspaceMemberSeatsService } from "@modules/domain/workspace-members"
import type { MemberSeatRecord } from "@modules/domain/workspace-members"
import { deskBoardOf, deskRightsOf } from "@tests/fixtures/builders/agent-desk.builder"
import type { DeskAsker, DeskRightsRollup } from "./agent-desk.contracts"
import { DeskReachService } from "./desk-reach.service"
import { DESK_RIGHTS_ROLLUP } from "./platform-ports.decorators"

const ASKER: DeskAsker = { workspaceId: "ws-1", memberId: "seat-1", locale: "en" }
const SEAT: MemberSeatRecord = {
    memberId: "seat-1",
    userId: "u-1",
    role: "staff",
    displayName: "Lan",
    status: "active",
}

const build = async () => {
    const rollups = mock<DeskRightsRollup>()
    rollups.agentRights.mockResolvedValue(deskRightsOf())
    const abilities = mock<AgentAccountsService>()
    abilities.board.mockResolvedValue(deskBoardOf())
    const seats = mock<WorkspaceMemberSeatsService>()
    seats.seatById.mockResolvedValue(SEAT)
    const moduleRef = await Test.createTestingModule({
        providers: [
            DeskReachService,
            { provide: DESK_RIGHTS_ROLLUP, useValue: rollups },
            { provide: AgentAccountsService, useValue: abilities },
            { provide: WorkspaceMemberSeatsService, useValue: seats },
        ],
    }).compile()
    return { service: moduleRef.get(DeskReachService), rollups, seats }
}

describe("DeskReachService: what an agent may touch", () => {
    it("reads the agent's node-rights roll-up as the seat's person and groups it by mode", async () => {
        const { service, rollups } = await build()

        await expect(service.reach(ASKER, "agent-1")).resolves.toEqual({
            accounts: [{ connectionId: "conn-1", name: "NIVO Web", providerName: "CRM", state: "connected" }],
            auto: ["Read customers"],
            ask: ["Update a contact"],
            none: ["Renew a service", "ticket.open"],
        })
        expect(rollups.agentRights).toHaveBeenCalledWith({ principalId: "u-1", workspaceId: "ws-1" }, "agent-1")
    })

    it("reaches nothing where the app bound no roll-up", async () => {
        const abilities = mock<AgentAccountsService>()
        const seats = mock<WorkspaceMemberSeatsService>()
        const moduleRef = await Test.createTestingModule({
            providers: [
                DeskReachService,
                { provide: AgentAccountsService, useValue: abilities },
                { provide: WorkspaceMemberSeatsService, useValue: seats },
            ],
        }).compile()

        await expect(moduleRef.get(DeskReachService).reach(ASKER, "agent-1")).resolves.toEqual({
            accounts: [],
            auto: [],
            ask: [],
            none: [],
        })
        expect(seats.seatById).not.toHaveBeenCalled()
    })

    it("shows nothing to an asker with no active seat", async () => {
        const { service, rollups, seats } = await build()
        seats.seatById.mockResolvedValueOnce(null)

        await expect(service.reach(ASKER, "agent-1")).resolves.toEqual({ accounts: [], auto: [], ask: [], none: [] })
        await expect(service.reach({ ...ASKER, memberId: null }, "agent-1")).resolves.toMatchObject({ accounts: [] })
        expect(rollups.agentRights).not.toHaveBeenCalled()
    })
})
