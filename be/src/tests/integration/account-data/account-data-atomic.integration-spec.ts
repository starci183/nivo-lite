import {
    AccountCursorsService,
    AccountDataIntakeService,
    AccountDataReadService,
    AccountDataRetentionService,
    type AccountWrite,
} from "@modules/domain/account-data"
import { useTestWorld } from "@tests/world/use-test-world"
import { ACCOUNT_DATA_PROOF_MODULES } from "@tests/world/account-data-proof.options"
import { accountRowsOf, ageRows, persistProofAccount, raced } from "@tests/world/account-data-atomic-proof.service"
import { persistAccountRows, type PersistedAccountRow } from "@tests/fixtures/builders/account-data.builder"
import { zaloEventRowsOf } from "../../../modules/domain/zalo-inbox/zalo.normalise.policy"
import { polledRawBody } from "../../../modules/domain/zalo-inbox/zalo-polled-body.policy"

/** The answer of every sweep fence: the proof's pass is never fenced out. */
const unfenced = (): Promise<void> => Promise.resolve()

/** Whether each write of a race inserted its row, the first committed one first. */
const newnessOf = (writes: ReadonlyArray<AccountWrite>): Array<boolean> =>
    writes.map((write) => write.rows.every((row) => row.isNew))

/** A Telegram update as the bot's webhook sends it. */
const telegramUpdateOf = (updateId: string, text: string) => ({
    type: "telegram.update",
    value: { updateId, raw: { update_id: Number(updateId), message: { text } } },
})

/** A read position of a mailbox agent, ordered as text. */
const cursorOf = (seenThrough: string) => ({ agentId: "agent-1", entity: "mail", seenThrough })

/** One stored interface answer of a person's read. */
const snapshotOf = (rows: number) => ({
    type: "interface.snapshot",
    value: { verb: "orders.list", argsHash: "h-1", status: "ok", durationMs: 12, rows, memberId: "m-1", answer: { rows } },
})

/** The person behind a Telegram user id, as the inbox keeps them. */
const telegramUserOf = (userId: string, username: string) => ({
    type: "telegram.user",
    value: { userId, username, chatId: `chat-${userId}` },
})

/** The key the snapshot's members make. */
const SNAPSHOT_KEY = "orders.list:h-1"

/** One customer message to a Zalo OA, as the reconcile run reads it back and as the webhook carries it. */
const ZALO_MESSAGE = { messageId: "msg-77", userId: "zu-1", text: "Still in stock?", sentAt: 1_763_000_000_000 }
const ZALO_WEBHOOK_BODY = Buffer.from(
    JSON.stringify({
        event_name: "user_send_text",
        timestamp: String(ZALO_MESSAGE.sentAt),
        sender: { id: ZALO_MESSAGE.userId },
        recipient: { id: "oa-1" },
        message: { msg_id: ZALO_MESSAGE.messageId, text: ZALO_MESSAGE.text },
    }),
)

const world = useTestWorld({ modules: [...ACCOUNT_DATA_PROOF_MODULES] })
const intake = (): AccountDataIntakeService => world.resolve(AccountDataIntakeService)
const reads = (): AccountDataReadService => world.resolve(AccountDataReadService)

describe("account_data intake under a race on the real database", () => {
    it("two concurrent writes of one telegram.update key insert one row, and exactly one answers isNew", async () => {
        const { connectionId } = await persistProofAccount(world, "telegram")
        const writes = await raced(
            world.db.primary,
            (tx) => intake().write(tx, connectionId, [telegramUpdateOf("9001", "first")]),
            (tx) => intake().write(tx, connectionId, [telegramUpdateOf("9001", "again")]),
        )
        expect(newnessOf(writes)).toEqual([true, false])
        const rows = await accountRowsOf(world.db.primary, connectionId, "telegram.update")
        expect(rows).toEqual([expect.objectContaining({ key: "9001", processedAt: null })])
        expect(rows[0]?.value).toMatchObject({ raw: { message: { text: "first" } } })
    })

    it("a polled Zalo message and its webhook racing on one zalo_oa.event key insert one row", async () => {
        const { connectionId } = await persistProofAccount(world, "zalo_oa")
        const writes = await raced(
            world.db.primary,
            (tx) => intake().write(tx, connectionId, zaloEventRowsOf(polledRawBody(ZALO_MESSAGE), "poll")),
            (tx) => intake().write(tx, connectionId, zaloEventRowsOf(ZALO_WEBHOOK_BODY)),
        )
        expect(newnessOf(writes)).toEqual([true, false])
        expect(writes[0].rows[0]?.key).toBe(writes[1].rows[0]?.key)
        const rows = await accountRowsOf(world.db.primary, connectionId, "zalo_oa.event")
        expect(rows).toHaveLength(1)
        expect(rows[0]?.value).toMatchObject({ source: "poll" })
    })
})

describe("account cursors on the real database", () => {
    const type = "imap.read-cursor"
    const key = "agent-1:mail"
    const first = "2026-11-13T10:00:00.000000Z"
    const stored = "2026-11-13T11:00:00.000000Z"

    it("a cursor moves forward once per position under a race, and never backward or in place", async () => {
        const { connectionId } = await persistProofAccount(world, "imap")
        const cursors = world.resolve(AccountCursorsService)
        const created = await raced(
            world.db.primary,
            (tx) => cursors.advance(connectionId, type, null, cursorOf(first), tx),
            (tx) => cursors.advance(connectionId, type, null, cursorOf("2026-11-13T09:00:00.000000Z"), tx),
        )
        expect(created).toEqual([true, false])
        expect(await accountRowsOf(world.db.primary, connectionId, type)).toHaveLength(1)
        const moved = await raced(
            world.db.primary,
            (tx) => cursors.advance(connectionId, type, first, cursorOf(stored), tx),
            (tx) => cursors.advance(connectionId, type, first, cursorOf("2026-11-13T12:00:00.000000Z"), tx),
        )
        expect(moved).toEqual([true, false])
        expect((await cursors.read(connectionId, type, key))?.value).toEqual(cursorOf(stored))
        expect(await cursors.advance(connectionId, type, stored, cursorOf(first))).toBe(false)
        expect(await cursors.advance(connectionId, type, stored, cursorOf(stored))).toBe(false)
        expect((await cursors.read(connectionId, type, key))?.value).toEqual(cursorOf(stored))
    })
})

describe("account_data overwrite and ttl on the real database", () => {
    it("an overwrite type replaces the value of its key, and reads as absent once older than its ttl", async () => {
        const { connectionId } = await persistProofAccount(world, "telegram")
        const first = await world.db.primary.transaction((tx) => intake().write(tx, connectionId, [snapshotOf(1)]))
        const second = await world.db.primary.transaction((tx) => intake().write(tx, connectionId, [snapshotOf(2)]))
        expect([first.rows[0]?.isNew, second.rows[0]?.isNew]).toEqual([true, false])
        expect(await accountRowsOf(world.db.primary, connectionId, "interface.snapshot")).toHaveLength(1)
        expect((await reads().get(connectionId, "interface.snapshot", SNAPSHOT_KEY))?.value).toMatchObject({ rows: 2 })
        await ageRows(world.db.primary, connectionId, "interface.snapshot", "2 minutes")
        expect(await reads().get(connectionId, "interface.snapshot", SNAPSHOT_KEY)).toBeNull()
    })

    it("two concurrent first writes of one interface.snapshot key insert one row, and exactly one answers isNew", async () => {
        const { connectionId } = await persistProofAccount(world, "telegram")
        const writes = await raced(
            world.db.primary,
            (tx) => intake().write(tx, connectionId, [snapshotOf(1)]),
            (tx) => intake().write(tx, connectionId, [snapshotOf(2)]),
        )
        expect(newnessOf(writes)).toEqual([true, false])
        expect(await accountRowsOf(world.db.primary, connectionId, "interface.snapshot")).toHaveLength(1)
        expect((await reads().get(connectionId, "interface.snapshot", SNAPSHOT_KEY))?.value).toMatchObject({ rows: 2 })
    })
})

describe("account_data partitions on the real database", () => {
    it("the database refuses a telegram.message without its required member, past every check of the code", async () => {
        const account = await persistProofAccount(world, "telegram")
        const message: PersistedAccountRow = {
            ...account,
            type: "telegram.message",
            provider: "telegram",
            key: "c-1:m-1",
            value: { chatId: "c-1", messageId: "m-1", direction: "in", text: "hi", at: "2026-11-13T10:00:00Z" },
        }
        await expect(persistAccountRows(world.db.primary, [message])).rejects.toThrow(
            /account_data_telegram_message_user_id_chk/,
        )
        expect(await accountRowsOf(world.db.primary, account.connectionId, "telegram.message")).toEqual([])
    })

    it("newestWhere answers the telegram.user the intake wrote, by a declared index member", async () => {
        const { connectionId } = await persistProofAccount(world, "telegram")
        await world.db.primary.transaction((tx) => intake().write(tx, connectionId, [telegramUserOf("u-1", "lan")]))
        await ageRows(world.db.primary, connectionId, "telegram.user", "1 hour")
        await world.db.primary.transaction((tx) =>
            intake().write(tx, connectionId, [telegramUserOf("u-2", "lan"), telegramUserOf("u-3", "minh")]),
        )
        const newest = (username: string) => reads().newestWhere(connectionId, "telegram.user", "username", username)
        expect((await newest("lan"))?.key).toBe("u-2")
        expect((await newest("minh"))?.value).toMatchObject({ chatId: "chat-u-3" })
        expect(await newest("nobody")).toBeNull()
    })
})

describe("account_data retention on the real database", () => {
    const message = {
        type: "telegram.message",
        value: { chatId: "c-1", messageId: "m-1", userId: "u-1", direction: "in", text: "hi", at: "2025-01-01T00:00:00.000Z" },
    }

    it("deletes a processed telegram.update past its window and keeps a pending one and a kept message", async () => {
        const { connectionId } = await persistProofAccount(world, "telegram")
        await world.db.primary.transaction(async (tx) => {
            await intake().write(tx, connectionId, [telegramUpdateOf("1", "done"), telegramUpdateOf("2", "pending"), message])
            const done = await intake().lockPending(tx, "telegram.update", connectionId, "1")
            if (done !== null) await intake().complete(tx, done)
        })
        await ageRows(world.db.primary, connectionId, "telegram.update", "31 days")
        await ageRows(world.db.primary, connectionId, "telegram.message", "400 days")
        const deleted = await world.resolve(AccountDataRetentionService).sweep({ batch: 100 }, unfenced)
        expect(deleted).toBeGreaterThanOrEqual(1)
        expect(await accountRowsOf(world.db.primary, connectionId, "telegram.update")).toEqual([
            expect.objectContaining({ key: "2", processedAt: null }),
        ])
        expect(await accountRowsOf(world.db.primary, connectionId, "telegram.message")).toHaveLength(1)
    })
})
