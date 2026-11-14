import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { AccountDataReadService } from "@modules/domain/account-data"
import { ConnectionBindingsReadService, type ConnectionStatusFacts } from "@modules/domain/connections"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { DataRecordsReadService } from "./data-records-read.service"
import { IMAP_MAIL_TYPE } from "./imap.data-types"
import { DataRecordEntity } from "./persistence/entities"

const ROW_1 = "11111111-1111-4111-8111-111111111111"
const ROW_2 = "22222222-2222-4222-8222-222222222222"
const ROW_3 = "33333333-3333-4333-8333-333333333333"

const MAIL_VALUE = {
    externalId: "INBOX:7:42",
    folder: "INBOX",
    uid: 42,
    date: "2026-11-10T08:00:00.000Z",
    from: [{ name: "An", address: "an@example.com" }],
    to: [{ name: null, address: "shop@example.com" }],
    subject: "Invoice 7",
    text: "Hello there",
    truncated: false,
    attachments: [{ name: "hd.xml", type: "text/xml", size: 120, xml: "<HDon/>" }],
    messageId: "<m1@example.com>",
}

const HEAD = {
    folder: "INBOX",
    uid: 42,
    from: MAIL_VALUE.from,
    to: MAIL_VALUE.to,
    subject: "Invoice 7",
    truncated: false,
    messageId: "<m1@example.com>",
}

const stored = (id: string, value: Readonly<Record<string, unknown>>) => ({
    id,
    type: IMAP_MAIL_TYPE,
    typeVersion: 1,
    key: String(value.externalId),
    value,
    occurredAt: new Date("2026-11-10T08:00:00.000Z"),
    processedAt: null,
})

const boxOf = (id: string): ConnectionStatusFacts => ({
    id,
    provider: "imap",
    name: id,
    status: "connected",
    createdAt: new Date("2026-11-01T00:00:00.000Z"),
    botUsername: null,
    accountMasked: null,
    lastError: null,
    oaId: null,
    email: null,
})

const OWNERS: Readonly<Record<string, string>> = { "box-1": "ws-1", "box-2": "ws-1", "box-x": "ws-2" }

const build = async (em: MockEntityManager = mockEntityManager()) => {
    const reads = mock<AccountDataReadService>()
    const bindings = mock<ConnectionBindingsReadService>()
    bindings.workspaceOf.mockImplementation((connectionId: string) => Promise.resolve(OWNERS[connectionId] ?? null))
    const moduleRef = await Test.createTestingModule({
        providers: [
            DataRecordsReadService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: AccountDataReadService, useValue: reads },
            { provide: ConnectionBindingsReadService, useValue: bindings },
        ],
    }).compile()
    return { service: moduleRef.get(DataRecordsReadService), em, reads, bindings }
}

describe("DataRecordsReadService: the mails of one mailbox", () => {
    it("reads the mailbox's imap.mail rows in the order they entered the store, with a fixed-width point and an opening only", async () => {
        const { service, reads } = await build()
        reads.after.mockResolvedValue([{ ...stored(ROW_1, MAIL_VALUE), createdAt: "2026-11-11 10:00:00.12+00" }])

        const rows = await service.mailsAfter("ws-1", "box-1", null, 11, 5)

        expect(reads.after).toHaveBeenCalledWith("box-1", IMAP_MAIL_TYPE, null, 11)
        expect(rows).toEqual([
            {
                id: ROW_1,
                connectionId: "box-1",
                seenAt: "2026-11-11T10:00:00.120000Z",
                occurredAt: "2026-11-10T08:00:00.000Z",
                head: HEAD,
                attachments: [{ name: "hd.xml", type: "text/xml", size: 120 }],
                opening: "Hello",
            },
        ])
    })

    it("reads only after the point it is given, in the text form the caller holds", async () => {
        const { service, reads } = await build()
        reads.after.mockResolvedValue([])

        await service.mailsAfter("ws-1", "box-1", { seenAt: "2026-11-11T10:00:00.123456Z", id: ROW_1 }, 5, 240)

        expect(reads.after).toHaveBeenCalledWith(
            "box-1",
            IMAP_MAIL_TYPE,
            { createdAt: "2026-11-11T10:00:00.123456Z", id: ROW_1 },
            5,
        )
    })

    it("reads nothing of a mailbox of another workspace", async () => {
        const { service, reads } = await build()

        await expect(service.mailsAfter("ws-1", "box-x", null, 5, 240)).resolves.toEqual([])
        expect(reads.after).not.toHaveBeenCalled()
    })
})

describe("DataRecordsReadService: one mail by its row id", () => {
    it("reads one mail whole from the mailboxes it is given, and nothing when it is given none", async () => {
        const { service, reads } = await build()
        reads.byId.mockResolvedValue({ ...stored(ROW_1, MAIL_VALUE), connectionId: "box-1", createdAt: "2026-11-11 10:00:00+00" })

        await expect(service.mailIn("ws-1", ["box-1", "box-2"], ROW_1)).resolves.toEqual({
            id: ROW_1,
            connectionId: "box-1",
            seenAt: "2026-11-11T10:00:00.000000Z",
            occurredAt: "2026-11-10T08:00:00.000Z",
            head: HEAD,
            attachments: [{ name: "hd.xml", type: "text/xml", size: 120 }],
            text: "Hello there",
        })
        expect(reads.byId).toHaveBeenCalledWith(IMAP_MAIL_TYPE, ROW_1)
        await expect(service.mailIn("ws-1", ["box-2"], ROW_1)).resolves.toBeUndefined()
        await expect(service.mailIn("ws-1", [], ROW_1)).resolves.toBeUndefined()
        expect(reads.byId).toHaveBeenCalledTimes(2)
    })

    it("reads a mail's attachments with the XML text, only for the caller's workspace and only by a row id", async () => {
        const { service, reads } = await build()
        reads.byId.mockResolvedValue({ ...stored(ROW_1, MAIL_VALUE), connectionId: "box-x", createdAt: "2026-11-11 10:00:00+00" })

        await expect(service.mailAttachments("ws-2", ROW_1)).resolves.toEqual({ id: ROW_1, attachments: MAIL_VALUE.attachments })
        await expect(service.mailAttachments("ws-1", ROW_1)).resolves.toBeUndefined()
        await expect(service.mailAttachments("ws-1", "not-a-row")).resolves.toBeUndefined()
        expect(reads.byId).toHaveBeenCalledTimes(2)
    })

    it("answers nothing for a row id no mail holds", async () => {
        const { service, reads } = await build()
        reads.byId.mockResolvedValue(null)

        await expect(service.mailAttachments("ws-1", ROW_2)).resolves.toBeUndefined()
    })
})

describe("DataRecordsReadService: mails with an XML attachment", () => {
    it("reads the newest mails of each mailbox of the workspace, keeps those with an XML from the day on, newest first, bounded", async () => {
        const { service, reads, bindings } = await build()
        bindings.ofProvider.mockResolvedValue([boxOf("box-1"), boxOf("box-2")])
        const old = { ...MAIL_VALUE, externalId: "INBOX:7:1", date: "2026-09-01T00:00:00.000Z" }
        const plain = { ...MAIL_VALUE, externalId: "INBOX:7:2", attachments: [{ name: "a.pdf", type: "application/pdf", size: 9 }] }
        const newer = { ...MAIL_VALUE, externalId: "INBOX:7:3", date: "2026-11-11T00:00:00.000Z" }
        reads.newest.mockImplementation((connectionId: string) =>
            Promise.resolve(
                connectionId === "box-1" ? [stored(ROW_1, MAIL_VALUE), stored(ROW_2, old)] : [stored(ROW_3, newer), stored(ROW_2, plain)],
            ),
        )

        const rows = await service.mailsWithXml("ws-1", "2026-10-01", 200)

        expect(bindings.ofProvider).toHaveBeenCalledWith("ws-1", "imap", 20)
        expect(reads.newest).toHaveBeenCalledWith("box-1", IMAP_MAIL_TYPE, 200)
        expect(rows.map((row) => row.id)).toEqual([ROW_3, ROW_1])
        expect(rows[0]?.attachments).toEqual(newer.attachments)
        await expect(service.mailsWithXml("ws-1", undefined, 1)).resolves.toHaveLength(1)
    })
})

describe("DataRecordsReadService: customer rows", () => {
    it("reads the newest customer rows, bounded, with the connection each came from", async () => {
        const row = Object.assign(new DataRecordEntity(), {
            connectionId: "c-1",
            externalId: "HTL-1",
            title: "Mai",
            data: { code: "HTL-1" },
        })
        const em = mockEntityManager({ find: [DataRecordEntity, [row]] })
        const { service } = await build(em)

        await expect(service.customerRecords("ws-1", 50)).resolves.toEqual([
            { connectionId: "c-1", externalId: "HTL-1", title: "Mai", data: { code: "HTL-1" } },
        ])
        expect(em.find).toHaveBeenCalledWith(
            DataRecordEntity,
            expect.objectContaining({ where: { workspaceId: "ws-1", entity: "customer" }, take: 50 }),
        )
    })
})
