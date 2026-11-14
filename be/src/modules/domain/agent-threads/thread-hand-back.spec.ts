import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import { TRIGGER } from "@nivo-lite/agent-sdk/names"
import { DeliveredWakesService } from "@modules/domain/provider-triggers/delivered-wakes.service"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LOGGER, type Logger } from "@modules/platform/logging"
import { handBackEventOf } from "./thread-hand-back.policy"
import { ThreadHandBacksService } from "./thread-hand-backs.service"

/** The triggers of the sale's payment wait, as its params hold them. */
const ON = [
    { key: "paid", verb: TRIGGER.paymentCreditReceived },
    { key: "said", verb: TRIGGER.zaloMessageReceived },
]

/** What the wait answered when the person's line came. */
const SAID = { trigger: "said", event: { eventId: "m-9", accountId: "acc-zalo", routeId: "route-1", data: { text: "hoi chut" } } }

describe("handBackEventOf: which event a hand-back gives back (the wait's own output)", () => {
    it("the event of the key that came, with the verb that key listens for", () => {
        expect(handBackEventOf(SAID, ON)).toEqual({ verb: TRIGGER.zaloMessageReceived, eventId: "m-9", accountId: "acc-zalo" })
    })

    it("nothing for the timeout, an unknown key, or an event with no id", () => {
        expect(handBackEventOf({ trigger: "timeout" }, ON)).toBeNull()
        expect(handBackEventOf({ trigger: "other", event: SAID.event }, ON)).toBeNull()
        expect(handBackEventOf({ trigger: "said", event: { data: {} } }, ON)).toBeNull()
    })
})

describe("ThreadHandBacksService: the event goes back to the next waiter, then to the registered graphs", () => {
    const build = async () => {
        const wakes = mock<DeliveredWakesService>()
        wakes.reoffer.mockResolvedValue(2)
        const manager = mockEntityManager()
        manager.transaction.mockImplementation(((work: (tx: unknown) => Promise<unknown>) => work(manager)) as never)
        const moduleRef = await Test.createTestingModule({
            providers: [
                ThreadHandBacksService,
                { provide: DeliveredWakesService, useValue: wakes },
                { provide: PRIMARY_ENTITY_MANAGER, useValue: manager },
                { provide: LOGGER, useValue: mock<Logger>() },
            ],
        }).compile()
        return { handBacks: moduleRef.get(ThreadHandBacksService), wakes, manager }
    }

    it("re-offers every wake of the event (its delivery's once-key: verb, account, id), naming this run", async () => {
        const { handBacks, wakes, manager } = await build()

        await expect(handBacks.handBack({ workspaceId: "ws-1", runId: "run-sale", agentId: "agent-sales" }, SAID, ON)).resolves.toEqual({
            kind: "handed_back",
            wakes: 2,
        })
        expect(wakes.reoffer).toHaveBeenCalledWith(
            manager,
            "ws-1",
            { source: "trigger", eventKey: `${TRIGGER.zaloMessageReceived}:acc-zalo:m-9`, reason: "wait_took" },
            "run-sale",
        )
    })

    it("an engine source's event (no account) is keyed by the agent it was delivered to", async () => {
        const { handBacks, wakes } = await build()
        const due = { trigger: "due", event: { eventId: "task-1:2026" } }

        await handBacks.handBack({ workspaceId: "ws-1", runId: "run-1", agentId: "agent-1" }, due, [{ key: "due", verb: TRIGGER.timerDue }])
        expect(wakes.reoffer.mock.calls[0]?.[2]).toMatchObject({ eventKey: `${TRIGGER.timerDue}:agent-1:task-1:2026` })
    })

    it("a wait that took no event gives nothing back", async () => {
        const { handBacks, wakes } = await build()

        await expect(handBacks.handBack({ workspaceId: "ws-1", runId: "run-1", agentId: "agent-1" }, { trigger: "timeout" }, ON)).resolves.toEqual({
            kind: "no_event",
        })
        expect(wakes.reoffer).not.toHaveBeenCalled()
    })
})

describe("ThreadHandBacksService.offerToWait: the events held behind a run are offered to its next wait first", () => {
    it("re-pends the run's held `waiting:<run>` wakes in one transaction", async () => {
        const wakes = mock<DeliveredWakesService>()
        wakes.releaseWaiting.mockResolvedValue(2)
        const manager = mockEntityManager()
        manager.transaction.mockImplementation(((work: (tx: unknown) => Promise<unknown>) => work(manager)) as never)
        const moduleRef = await Test.createTestingModule({
            providers: [
                ThreadHandBacksService,
                { provide: DeliveredWakesService, useValue: wakes },
                { provide: PRIMARY_ENTITY_MANAGER, useValue: manager },
            ],
        }).compile()

        await expect(moduleRef.get(ThreadHandBacksService).offerToWait("ws-1", "run-sale")).resolves.toBe(2)
        expect(wakes.releaseWaiting).toHaveBeenCalledWith(manager, "ws-1", "run-sale")
    })
})
