import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { WORK_PERFORMER_REGISTRY } from "@modules/domain/decisions"
import type { WorkContext, WorkPerformerRegistry } from "@modules/domain/decisions"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { freezeCatalog } from "@tests/fixtures/builders/lead-freezes.builder"
import { itemOf } from "@tests/fixtures/builders/work-decision.builder"
import { LeadFreezePerformerService } from "./lead-freeze-performer.service"
import { LeadFreezesService } from "./lead-freezes.service"

const CTX: WorkContext = { workspaceId: "ws-1", actor: "Owner", locale: "en" }

const ITEM = itemOf({ action: "lead_frozen", proposal: { summary: "s", fields: { freezeId: "freeze-1" } } })

const BARE = itemOf({ action: "lead_frozen", proposal: { summary: "s", fields: {} } })

const OWNER = { name: "Owner", kind: "owner" as const, memberId: "member-1" }

const build = async () => {
    const registry = mock<WorkPerformerRegistry>()
    const freezes = mock<LeadFreezesService>({
        retry: jest.fn().mockResolvedValue("released"),
        skip: jest.fn().mockResolvedValue("skipped"),
        reraise: jest.fn().mockResolvedValue(undefined),
    })
    const catalog = mock<MessageCatalog>({ get: jest.fn(freezeCatalog.get) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            LeadFreezePerformerService,
            { provide: WORK_PERFORMER_REGISTRY, useValue: registry },
            { provide: LeadFreezesService, useValue: freezes },
            { provide: MESSAGE_CATALOG, useValue: catalog },
        ],
    }).compile()
    return { performer: moduleRef.get(LeadFreezePerformerService), registry, freezes }
}

describe("LeadFreezePerformerService", () => {
    it("registers as the performer of the lead_frozen item at boot, and keeps the proposal its freeze preset", async () => {
        const { performer, registry } = await build()
        performer.onModuleInit()
        expect(registry.add).toHaveBeenCalledWith("lead_frozen", performer)
        await expect(performer.prepare(CTX, ITEM)).resolves.toEqual({ proposal: ITEM.proposal })
    })

    it("approving retries the run under the member who decided", async () => {
        const { performer, freezes } = await build()

        const performed = await performer.perform(CTX, ITEM, ITEM.proposal, OWNER)

        expect(freezes.retry).toHaveBeenCalledWith("ws-1", "freeze-1", "member-1")
        expect(freezes.reraise).not.toHaveBeenCalled()
        expect(performed.summary).toBe("The retry succeeded; the customer is released and the waiting events run on.")
        expect(performed).toMatchObject({ evidence: "captured", lead_id: "lead-1" })
    })

    it("raises the next item when the retry did not release the customer", async () => {
        const { performer, freezes } = await build()
        freezes.retry.mockResolvedValueOnce("still_frozen").mockResolvedValueOnce("not_retryable")

        const still = await performer.perform(CTX, ITEM, ITEM.proposal, { name: "Owner" })
        await performer.perform(CTX, ITEM, ITEM.proposal, OWNER)

        expect(freezes.retry).toHaveBeenNthCalledWith(1, "ws-1", "freeze-1", "Owner")
        expect(freezes.reraise).toHaveBeenCalledTimes(2)
        expect(still.summary).toBe("The retry failed again; the customer still waits and a new item is open.")
    })

    it("rejecting skips the turn; an item that names no freeze does nothing", async () => {
        const { performer, freezes } = await build()

        await performer.onReject(CTX, ITEM, ITEM.proposal, OWNER)
        await performer.onReject(CTX, BARE, BARE.proposal, OWNER)
        const none = await performer.perform(CTX, BARE, BARE.proposal, OWNER)

        expect(freezes.skip).toHaveBeenCalledTimes(1)
        expect(freezes.skip).toHaveBeenCalledWith("ws-1", "freeze-1", "member-1")
        expect(none.summary).toBe("The customer no longer waits.")
    })
})
