import { Test } from "@nestjs/testing"
import { mock, mockEntityManager, type MockEntityManager } from "@starci/jest-preset"
import type { AccountWrite } from "@modules/domain/account-data"
import { ProviderTriggersService } from "@modules/domain/provider-triggers"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { TestWorldError, TestWorldErrorCode } from "@tests/world/test-world.error"
import { DataSyncTriggerService } from "./data-sync-trigger.service"
import { IMAP_MAIL_TRIGGER } from "./imap-mail.trigger"

const OWNER = { provider: "imap", connectionId: "box-1", workspaceId: "ws-1" }

/** One `imap.mail` input as the sync writes it. */
const mail = (uid: number) => ({
    type: "imap.mail",
    value: {
        externalId: `INBOX:7:${String(uid)}`,
        folder: "INBOX",
        uid,
        date: "2026-11-14T01:00:00.000Z",
        subject: "Hoa don",
        text: "never on the event",
        attachments: [],
    },
})

/** What the intake answered: one row per mail, `true` for a row it inserted. */
const written = (...fresh: ReadonlyArray<boolean>): AccountWrite => ({
    owner: OWNER,
    rows: fresh.map((isNew, index) => ({ type: "imap.mail", key: `k${String(index)}`, id: isNew ? `row-${String(index)}` : "", isNew })),
})

/** A manager whose nested transaction runs its work on itself, as a savepoint does. */
const savepointManager = (): MockEntityManager => {
    const manager = mockEntityManager()
    manager.transaction.mockImplementation(async (...args: ReadonlyArray<unknown>) => {
        const work = args.at(-1)
        if (typeof work !== "function") throw new TestWorldError({ code: TestWorldErrorCode.RowMissing, params: { what: "no work" } })
        const done: unknown = await Reflect.apply(work, undefined, [manager])
        return done
    })
    return manager
}

const build = async (registered = true) => {
    const tx = savepointManager()
    const triggers = mock<ProviderTriggersService>()
    triggers.deliver.mockResolvedValue({ status: "delivered", events: 1, dropped: 0, woken: [], repeats: 0, untaken: 0, held: 0 })
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            DataSyncTriggerService,
            { provide: LOGGER, useValue: logger },
            ...(registered ? [{ provide: ProviderTriggersService, useValue: triggers }] : []),
        ],
    }).compile()
    return { service: moduleRef.get(DataSyncTriggerService), tx, triggers, logger }
}

describe("DataSyncTriggerService deliverMails", () => {
    it("hands each NEW mail row to the ONE delivery as the mailbox's trigger translates it, ids and time only", async () => {
        const { service, tx, triggers } = await build()

        await service.deliverMails(tx, [mail(1), mail(2)], written(true, false))

        expect(triggers.deliver).toHaveBeenCalledTimes(1)
        expect(triggers.deliver).toHaveBeenCalledWith(
            {
                workspaceId: "ws-1",
                declaration: IMAP_MAIL_TRIGGER,
                connectionId: "box-1",
                agentId: null,
                events: [
                    {
                        event: { id: "INBOX:7:1", data: { mailId: "INBOX:7:1", folder: "INBOX", at: "2026-11-14T01:00:00.000Z" } },
                        raw: { type: "imap.mail", id: "row-0" },
                        occurredAt: "2026-11-14T01:00:00.000Z",
                    },
                ],
            },
            tx,
        )
    })

    it("delivers nothing when no mail is new, for an account nobody holds, or with no trigger capability bound", async () => {
        const none = await build()
        await none.service.deliverMails(none.tx, [mail(1)], written(false))
        await none.service.deliverMails(none.tx, [mail(1)], { owner: null, rows: [] })
        expect(none.triggers.deliver).not.toHaveBeenCalled()

        const bare = await build(false)
        await expect(bare.service.deliverMails(bare.tx, [mail(1)], written(true))).resolves.toBeUndefined()
    })

    it("never throws: a failure of the delivery is logged and the kept rows stand", async () => {
        const { service, tx, triggers, logger } = await build()
        triggers.deliver.mockRejectedValue(new Error("down"))

        await expect(service.deliverMails(tx, [mail(1)], written(true))).resolves.toBeUndefined()
        expect(logger.error).toHaveBeenCalledTimes(1)
    })
})
