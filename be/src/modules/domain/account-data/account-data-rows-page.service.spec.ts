import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { type ConnectionRecord, ConnectionsService } from "@modules/domain/connections"
import type { AccountDataTypeDef } from "./account-data.contracts"
import { AccountDataReadService } from "./account-data-read.service"
import { AccountDataRowsPageService } from "./account-data-rows-page.service"
import { AccountDataTypesService } from "./account-data-types.service"

const SEPAY_LINE: AccountDataTypeDef = {
    name: "sepay.transaction",
    provider: "sepay",
    version: 2,
    write: "append",
    fields: { id: { type: "integer", required: true }, amount: { type: "number", required: true } },
    key: ["id"],
    retention: "keep",
    secretFields: ["token"],
}

const TELEGRAM_UPDATE: AccountDataTypeDef = { ...SEPAY_LINE, name: "telegram.update", provider: "telegram", fields: {} }

const ANY_PROVIDER: AccountDataTypeDef = { ...SEPAY_LINE, name: "interface.snapshot", provider: null, fields: {} }

const ACTOR = { principalId: "user-1", workspaceId: "ws-1" }

const build = async () => {
    const connections = mock<ConnectionsService>()
    const types = mock<AccountDataTypesService>()
    const reads = mock<AccountDataReadService>()
    connections.authorize.mockResolvedValue({ role: "owner", displayName: "Lan" })
    connections.get.mockResolvedValue(mock<ConnectionRecord>({ id: "conn-1", workspaceId: "ws-1", provider: "sepay" }))
    types.all.mockReturnValue([SEPAY_LINE, TELEGRAM_UPDATE, ANY_PROVIDER])
    types.of.mockImplementation((name) => [SEPAY_LINE, TELEGRAM_UPDATE, ANY_PROVIDER].find((type) => type.name === name) ?? null)
    reads.newest.mockResolvedValue([
        {
            id: "row-1",
            type: "sepay.transaction",
            typeVersion: 2,
            key: "77",
            value: { id: 77, amount: 250000 },
            occurredAt: new Date("2026-11-13T06:00:00.000Z"),
            processedAt: null,
        },
    ])
    const moduleRef = await Test.createTestingModule({
        providers: [
            AccountDataRowsPageService,
            { provide: ConnectionsService, useValue: connections },
            { provide: AccountDataTypesService, useValue: types },
            { provide: AccountDataReadService, useValue: reads },
        ],
    }).compile()
    return { service: moduleRef.get(AccountDataRowsPageService), connections, types, reads }
}

describe("AccountDataRowsPageService: a connected account's raw provider data, for an owner or a manager of its workspace", () => {
    it("lists the declared types an account of this connection's provider stores (never the secret members' names)", async () => {
        const { service, connections } = await build()

        await expect(service.types(ACTOR, "conn-1")).resolves.toEqual([
            { type: "sepay.transaction", provider: "sepay", version: 2, write: "append", fields: ["id", "amount"] },
            { type: "interface.snapshot", provider: null, version: 2, write: "append", fields: [] },
        ])
        expect(connections.authorize).toHaveBeenCalledWith(ACTOR, ["owner", "manager"])
        expect(connections.get).toHaveBeenCalledWith("ws-1", "conn-1")
    })

    it("reads the newest rows of one declared type of the account, newest first, bounded", async () => {
        const { service, reads } = await build()

        await expect(service.rows(ACTOR, { connectionId: "conn-1", type: "sepay.transaction", limit: 500 })).resolves.toEqual({
            refusal: null,
            rows: [{ id: "row-1", key: "77", typeVersion: 2, occurredAt: "2026-11-13T06:00:00.000Z", value: { id: 77, amount: 250000 } }],
        })
        expect(reads.newest).toHaveBeenCalledWith("conn-1", "sepay.transaction", 100)
    })

    it("refuses a type the account's provider does not store, and an undeclared type, reading nothing", async () => {
        const { service, reads } = await build()

        await expect(service.rows(ACTOR, { connectionId: "conn-1", type: "telegram.update" })).resolves.toEqual({
            refusal: "type_not_of_account",
            rows: [],
        })
        await expect(service.rows(ACTOR, { connectionId: "conn-1", type: "nope.type" })).resolves.toEqual({
            refusal: "type_unknown",
            rows: [],
        })
        expect(reads.newest).not.toHaveBeenCalled()
    })

    it("checks the seat before touching the connection or its data", async () => {
        const { service, connections, reads } = await build()
        connections.authorize.mockRejectedValue(new Error("forbidden"))

        await expect(service.rows(ACTOR, { connectionId: "conn-1", type: "sepay.transaction" })).rejects.toThrow("forbidden")
        expect(connections.get).not.toHaveBeenCalled()
        expect(reads.newest).not.toHaveBeenCalled()
    })
})
