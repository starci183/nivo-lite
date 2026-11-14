import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AccountCursorsService } from "@modules/domain/account-data"
import { DataReadCursorsService } from "./data-read-cursors.service"
import type { HubReader } from "./data-records.contracts"
import { IMAP_READ_CURSOR_TYPE } from "./imap.data-types"

const READER: HubReader = { workspaceId: "ws-1", agentId: "agent-1", entity: "message" }
const KEY = "agent-1:message"
const P1 = "2026-11-11T10:00:00.100000Z~11111111-1111-4111-8111-111111111111"
const P2 = "2026-11-11T10:00:00.200000Z~22222222-2222-4222-8222-222222222222"
const P3 = "2026-11-11T10:00:01.000000Z~33333333-3333-4333-8333-333333333333"

const rowOf = (seenThrough: string) => ({
    id: "row-1",
    type: IMAP_READ_CURSOR_TYPE,
    typeVersion: 1,
    key: KEY,
    value: { agentId: "agent-1", entity: "message", seenThrough },
    occurredAt: new Date("2026-11-11T10:00:00.000Z"),
    processedAt: null,
})

const build = async () => {
    const cursors = mock<AccountCursorsService>()
    const moduleRef = await Test.createTestingModule({
        providers: [DataReadCursorsService, { provide: AccountCursorsService, useValue: cursors }],
    }).compile()
    return { service: moduleRef.get(DataReadCursorsService), cursors }
}

describe("DataReadCursorsService", () => {
    it("reads the reader's saved point on each connection from its imap.read-cursor row, and none for a connection never read", async () => {
        const { service, cursors } = await build()
        cursors.read.mockImplementation((connectionId: string) => Promise.resolve(connectionId === "box-1" ? rowOf(P1) : null))

        const points = await service.pointsOf(READER, ["box-1", "box-2"])

        expect([...points]).toEqual([["box-1", P1]])
        expect(cursors.read).toHaveBeenCalledWith("box-1", IMAP_READ_CURSOR_TYPE, KEY)
        expect(cursors.read).toHaveBeenCalledWith("box-2", IMAP_READ_CURSOR_TYPE, KEY)
    })

    it("asks nothing for no connection and at most 50 connections", async () => {
        const { service, cursors } = await build()
        cursors.read.mockResolvedValue(null)

        await expect(service.pointsOf(READER, [])).resolves.toEqual(new Map())
        expect(cursors.read).not.toHaveBeenCalled()
        await service.pointsOf(READER, Array.from({ length: 60 }, (_unused, index) => `box-${index}`))
        expect(cursors.read).toHaveBeenCalledTimes(50)
    })

})

describe("DataReadCursorsService.advance", () => {
    it("writes the first point of a reader against no row", async () => {
        const { service, cursors } = await build()
        cursors.read.mockResolvedValue(null)
        cursors.advance.mockResolvedValue(true)

        await service.advance(READER, "box-1", P1)

        expect(cursors.advance).toHaveBeenCalledWith("box-1", IMAP_READ_CURSOR_TYPE, null, {
            agentId: "agent-1",
            entity: "message",
            seenThrough: P1,
        })
    })

    it("moves the point forward against the saved one", async () => {
        const { service, cursors } = await build()
        cursors.read.mockResolvedValue(rowOf(P1))
        cursors.advance.mockResolvedValue(true)

        await service.advance(READER, "box-1", P2)

        expect(cursors.advance).toHaveBeenCalledWith("box-1", IMAP_READ_CURSOR_TYPE, P1, expect.objectContaining({ seenThrough: P2 }))
    })

    it("never moves the point back", async () => {
        const { service, cursors } = await build()
        cursors.read.mockResolvedValue(rowOf(P2))

        await service.advance(READER, "box-1", P1)
        await service.advance(READER, "box-1", P2)

        expect(cursors.advance).not.toHaveBeenCalled()
    })

    it("on a lost race reads again and keeps the greater point", async () => {
        const { service, cursors } = await build()
        cursors.read.mockResolvedValueOnce(rowOf(P1)).mockResolvedValueOnce(rowOf(P3))
        cursors.advance.mockResolvedValue(false)

        await service.advance(READER, "box-1", P2)

        expect(cursors.advance).toHaveBeenCalledTimes(1)
        expect(cursors.read).toHaveBeenCalledTimes(2)
    })

    it("on a lost race to a smaller point tries again from it, a bounded number of times", async () => {
        const { service, cursors } = await build()
        cursors.read.mockResolvedValueOnce(null).mockResolvedValue(rowOf(P1))
        cursors.advance.mockResolvedValueOnce(false).mockResolvedValueOnce(true)

        await service.advance(READER, "box-1", P2)

        expect(cursors.advance).toHaveBeenNthCalledWith(2, "box-1", IMAP_READ_CURSOR_TYPE, P1, expect.objectContaining({ seenThrough: P2 }))

        cursors.advance.mockResolvedValue(false)
        cursors.advance.mockClear()
        await service.advance(READER, "box-1", P2)
        expect(cursors.advance).toHaveBeenCalledTimes(3)
    })
})
