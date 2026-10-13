import { Test } from "@nestjs/testing"
import { FakeClock, builder, mockEntityManager } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { InboundEventsErrorCode } from "./errors/inbound-events.error"
import type { SimulatedInboundInput } from "./inbound-events.contracts"
import { InboundSimulationStoreService } from "./inbound-simulation-store.service"
import { INSERT_INPUT_EVENT } from "./persistence/inbound-events.sql"
import { BUMP_SIMULATION_DUPLICATE } from "./persistence/inbound-simulation.sql"

const NOW = "2026-10-13T10:00:00.000Z"

const input = builder<SimulatedInboundInput>({
    workspaceId: "ws-1",
    channel: "telegram",
    kind: "payment",
    origin: "live",
    senderName: "Minh",
    senderContact: "84901234567",
    body: "Paid",
    externalRef: "ref-1",
    eventId: " evt-1 ",
    amountVnd: 150000,
})

const build = async () => {
    const clock = new FakeClock(NOW)
    const moduleRef = await Test.createTestingModule({
        providers: [InboundSimulationStoreService, { provide: CLOCK, useValue: clock }],
    }).compile()
    return moduleRef.get(InboundSimulationStoreService)
}

describe("InboundSimulationStoreService", () => {
    describe("record", () => {
        it("records a simulated input under a trimmed dedupe key and ignores the caller's origin", async () => {
            const manager = mockEntityManager({ query: [[INSERT_INPUT_EVENT, [{ id: "event-1" }]]] })
            const store = await build()

            await expect(store.record(manager, input())).resolves.toEqual({
                duplicate: false,
                inboundEventId: "event-1",
            })

            expect(manager.query.mock.calls).toEqual([
                [
                    INSERT_INPUT_EVENT,
                    [
                        "ws-1",
                        "telegram",
                        "payment",
                        "simulated",
                        "Minh",
                        "84901234567",
                        "Paid",
                        150000,
                        "ref-1",
                        "evt-1",
                        "simulated:telegram:payment:evt-1",
                    ],
                ],
            ])
        })

        it("counts a repeated simulated delivery on the original row and keeps the caller's amount", async () => {
            const manager = mockEntityManager({
                query: [
                    [INSERT_INPUT_EVENT, []],
                    [BUMP_SIMULATION_DUPLICATE, [{ id: "event-1" }]],
                ],
            })
            const store = await build()

            await expect(
                store.record(
                    manager,
                    input({
                        eventId: " evt-2 ",
                        amountVnd: null,
                        senderName: null,
                        senderContact: null,
                        externalRef: null,
                    }),
                ),
            ).resolves.toEqual({ duplicate: true, inboundEventId: "event-1" })

            expect(manager.query.mock.calls).toEqual([
                [
                    INSERT_INPUT_EVENT,
                    [
                        "ws-1",
                        "telegram",
                        "payment",
                        "simulated",
                        null,
                        null,
                        "Paid",
                        null,
                        null,
                        "evt-2",
                        "simulated:telegram:payment:evt-2",
                    ],
                ],
                [BUMP_SIMULATION_DUPLICATE, ["ws-1", "simulated:telegram:payment:evt-2", new Date(NOW)]],
            ])
        })

        it("fails when a repeat's original row cannot be read back", async () => {
            const manager = mockEntityManager({
                query: [
                    [INSERT_INPUT_EVENT, []],
                    [BUMP_SIMULATION_DUPLICATE, []],
                ],
            })
            const store = await build()

            await expect(store.record(manager, input())).rejects.toMatchObject({
                code: InboundEventsErrorCode.Unreadable,
            })

            expect(manager.query.mock.calls[1]).toEqual([
                BUMP_SIMULATION_DUPLICATE,
                ["ws-1", "simulated:telegram:payment:evt-1", new Date(NOW)],
            ])
        })
    })
})
