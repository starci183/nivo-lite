import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { ConnectionsError, ConnectionsErrorCode, ConnectionsService } from "@modules/domain/connections"
import type { AccountDataStats } from "./account-data.contracts"
import { AccountDataPageService } from "./account-data-page.service"
import { AccountDataReadService } from "./account-data-read.service"

const CONNECTION_ID = "0b6f7a52-3c1e-4c39-9d55-1f2a6e0c9b11"
const STATS: AccountDataStats = {
    types: [
        { type: "telegram.message", purpose: null, rows: 12, newestAt: new Date("2026-11-12T03:00:00.000Z") },
        { type: "telegram.update", purpose: "chat.event", rows: 4, newestAt: new Date("2026-11-12T03:00:00.000Z") },
    ],
}

const build = async () => {
    const connections = mock<ConnectionsService>()
    connections.authorize.mockResolvedValue({ role: "manager", displayName: "Minh" })
    connections.get.mockImplementation((workspaceId: string, id: string) =>
        workspaceId === "ws-1" && id === CONNECTION_ID
            ? Promise.resolve(mock<Awaited<ReturnType<ConnectionsService["get"]>>>({ id }))
            : Promise.reject(new ConnectionsError({ code: ConnectionsErrorCode.NotFound, params: { id } })),
    )
    const reads = mock<AccountDataReadService>()
    reads.statsOf.mockResolvedValue(STATS)
    const moduleRef = await Test.createTestingModule({
        providers: [
            AccountDataPageService,
            { provide: ConnectionsService, useValue: connections },
            { provide: AccountDataReadService, useValue: reads },
        ],
    }).compile()
    return { page: moduleRef.get(AccountDataPageService), connections, reads }
}

describe("AccountDataPageService.statsFor", () => {
    it("proves the caller a manager of the workspace, finds the connection in it and counts the account's own rows", async () => {
        const { page, connections, reads } = await build()

        await expect(page.statsFor({ principalId: "user-1", workspaceId: "ws-1" }, CONNECTION_ID)).resolves.toEqual(
            STATS,
        )

        expect(connections.authorize).toHaveBeenCalledWith({ principalId: "user-1", workspaceId: "ws-1" }, [
            "owner",
            "manager",
        ])
        expect(connections.get).toHaveBeenCalledWith("ws-1", CONNECTION_ID)
        expect(reads.statsOf).toHaveBeenCalledWith(CONNECTION_ID)
    })

    it("refuses a caller who is no manager of the workspace and never counts", async () => {
        const { page, connections, reads } = await build()
        connections.authorize.mockRejectedValue(new ConnectionsError({ code: ConnectionsErrorCode.Forbidden }))

        await expect(
            page.statsFor({ principalId: "user-1", workspaceId: "ws-2" }, CONNECTION_ID),
        ).rejects.toMatchObject({
            code: ConnectionsErrorCode.Forbidden,
        })
        expect(connections.get).not.toHaveBeenCalled()
        expect(reads.statsOf).not.toHaveBeenCalled()
    })

    it("answers not found for a connection of another workspace, even to a manager of the caller's own", async () => {
        const { page, reads } = await build()

        await expect(
            page.statsFor({ principalId: "user-1", workspaceId: "ws-2" }, CONNECTION_ID),
        ).rejects.toMatchObject({
            code: ConnectionsErrorCode.NotFound,
        })
        expect(reads.statsOf).not.toHaveBeenCalled()
    })
})
