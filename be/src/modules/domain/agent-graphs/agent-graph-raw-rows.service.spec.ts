import { mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { AccountDataReadService, AccountDataTypesService } from "@modules/domain/account-data"
import { ConnectionBindingsReadService, type ConnectionRecord } from "@modules/domain/connections"
import { AgentGraphRawRowsService } from "./agent-graph-raw-rows.service"

/** The row types the account data declares: one of the purpose of the customer messages, one of events. */
const TYPES = [
    { name: "zalo_oa.event", purpose: "chat.event" },
    { name: "zalo_oa.message", purpose: "chat.message" },
]

/** The raw rows by id, as the account data holds them: every one on the workspace's own connection `conn-1`. */
const ROWS: Record<string, Readonly<Record<string, unknown>>> = {
    "row-1": { text: "Hello shop", at: "2026-11-04T01:00:00.000Z" },
    "row-2": { text: "Transfer done", at: "2026-11-04T01:00:05.000Z" },
}

const rowOf = (id: string, connectionId: string): Awaited<ReturnType<AccountDataReadService["byId"]>> => {
    const value = ROWS[id]
    return value === undefined ? null : { id, connectionId, value, occurredAt: new Date(), processedAt: null, key: id, type: "zalo_oa.message", typeVersion: 1, createdAt: "x" }
}

const build = async (own = true) => {
    const rows = mock<AccountDataReadService>()
    rows.byId.mockImplementation((_type, id) => Promise.resolve(rowOf(id, "conn-1")))
    const types = mock<AccountDataTypesService>({ all: jest.fn().mockReturnValue(TYPES) })
    const connections = mock<ConnectionBindingsReadService>()
    connections.recordOf.mockResolvedValue(own ? mock<ConnectionRecord>({ id: "conn-1" }) : null)
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentGraphRawRowsService,
            { provide: AccountDataReadService, useValue: rows },
            { provide: AccountDataTypesService, useValue: types },
            { provide: ConnectionBindingsReadService, useValue: connections },
        ],
    }).compile()
    return { service: moduleRef.get(AgentGraphRawRowsService), rows, connections }
}

describe("AgentGraphRawRowsService.rowOf", () => {
    it("reads the value of the row of the id among the row types of the purpose only, and only on one of the workspace's own connections", async () => {
        const { service, rows, connections } = await build()

        await expect(service.rowOf("ws-1", "chat.message", "row-1")).resolves.toEqual(ROWS["row-1"])
        expect(rows.byId).toHaveBeenCalledTimes(1)
        expect(rows.byId).toHaveBeenCalledWith("zalo_oa.message", "row-1")
        expect(connections.recordOf).toHaveBeenCalledWith("ws-1", "conn-1")

        const foreign = await build(false)
        await expect(foreign.service.rowOf("ws-1", "chat.message", "row-1")).resolves.toBeNull()
        await expect(service.rowOf("ws-1", "chat.message", "gone")).resolves.toBeNull()
    })

    it("reads nothing in an app with no account store", async () => {
        const moduleRef = await Test.createTestingModule({ providers: [AgentGraphRawRowsService] }).compile()

        await expect(moduleRef.get(AgentGraphRawRowsService).rowOf("ws-1", "chat.message", "row-1")).resolves.toBeNull()
    })
})
