import { Test } from "@nestjs/testing"
import { FakeClock } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { Secret } from "@modules/platform/config"
import { SepaySimulationError, SepaySimulationErrorCode } from "./errors/sepay-simulation.error"
import { SEPAY_SIMULATION_OPTIONS } from "./sepay-simulation.decorators"
import type { SepaySimulationOptions } from "./sepay-simulation.options"
import { SepaySimulationService } from "./sepay-simulation.service"

const NOW = "2026-10-12T18:20:30.456Z"
const BODY = {
    id: 1791829230456,
    gateway: "MBBank",
    transactionDate: "2026-10-13 01:20:30",
    accountNumber: "0123456789",
    subAccount: null,
    code: null,
    content: "NIVO8F3K2 chuyen tien",
    transferType: "in",
    description: "BankAPINotify NIVO8F3K2 chuyen tien",
    transferAmount: 0,
    referenceCode: "FT1791829230456",
    accumulated: 0,
}

const build = async (overrides: Partial<SepaySimulationOptions> = {}, status = 200) => {
    const post = jest.fn().mockResolvedValue({ status, text: "accepted" })
    const print = jest.fn()
    const moduleRef = await Test.createTestingModule({
        providers: [
            SepaySimulationService,
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            {
                provide: SEPAY_SIMULATION_OPTIONS,
                useValue: {
                    apiKey: new Secret("sepay-key"),
                    bankCode: "MBBank",
                    bankAccount: "0123456789",
                    url: "http://localhost:3000/api/sepay/webhook",
                    post,
                    print,
                    ...overrides,
                },
            },
        ],
    }).compile()
    return { simulation: moduleRef.get(SepaySimulationService), post, print }
}

describe("SepaySimulationService", () => {
    it("refuses a missing order code before sending or printing anything", async () => {
        const { simulation, post, print } = await build({ apiKey: undefined })

        await expect(simulation.run([], {})).rejects.toEqual(
            new SepaySimulationError({ code: SepaySimulationErrorCode.OrderCodeMissing }),
        )
        expect(post).not.toHaveBeenCalled()
        expect(print).not.toHaveBeenCalled()
    })

    it("refuses a missing webhook key before sending or printing anything", async () => {
        const { simulation, post, print } = await build({ apiKey: undefined })

        await expect(simulation.run(["NIVO8F3K2", "299000"], {})).rejects.toEqual(
            new SepaySimulationError({ code: SepaySimulationErrorCode.KeyMissing }),
        )
        expect(post).not.toHaveBeenCalled()
        expect(print).not.toHaveBeenCalled()
    })

    it.each(["not-a-number", "Infinity", "-Infinity", "1e309"])(
        "refuses non-finite amount %s before sending or printing anything",
        async (amount) => {
            const { simulation, post, print } = await build()
            const result = simulation.run(["NIVO8F3K2", amount], {})

            await expect(result).rejects.toBeInstanceOf(SepaySimulationError)
            await expect(result).rejects.toMatchObject({ code: "SEPAY_SIMULATION_NUMBER_INVALID" })
            expect(post).not.toHaveBeenCalled()
            expect(print).not.toHaveBeenCalled()
        },
    )

    it.each(["not-a-number", "Infinity", "-Infinity", "1e309"])(
        "refuses non-finite transaction id %s before sending or printing anything",
        async (id) => {
            const { simulation, post, print } = await build()
            const result = simulation.run(["NIVO8F3K2", "299000"], { id })

            await expect(result).rejects.toBeInstanceOf(SepaySimulationError)
            await expect(result).rejects.toMatchObject({ code: "SEPAY_SIMULATION_NUMBER_INVALID" })
            expect(post).not.toHaveBeenCalled()
            expect(print).not.toHaveBeenCalled()
        },
    )

    it("sends a zero-amount credit to the configured url and prints the answer", async () => {
        const { simulation, post, print } = await build()

        await expect(simulation.run(["NIVO8F3K2"], {})).resolves.toBeUndefined()

        expect(post.mock.calls).toEqual([
            [
                {
                    url: "http://localhost:3000/api/sepay/webhook",
                    headers: { "Content-Type": "application/json", Authorization: "Apikey sepay-key" },
                    body: JSON.stringify(BODY),
                },
            ],
        ])
        expect(print.mock.calls).toEqual([
            ["200 accepted"],
            ['sent id=1791829230456 content="NIVO8F3K2 chuyen tien" amount=0'],
        ])
    })

    it("uses the supplied amount, id, debit flag and url and accepts the last success status", async () => {
        const { simulation, post, print } = await build({}, 299)

        await expect(
            simulation.run(["NIVO8F3K2", "299000"], {
                id: "0",
                out: true,
                url: "http://localhost:4000/custom-webhook",
            }),
        ).resolves.toBeUndefined()

        expect(post.mock.calls).toEqual([
            [
                {
                    url: "http://localhost:4000/custom-webhook",
                    headers: { "Content-Type": "application/json", Authorization: "Apikey sepay-key" },
                    body: JSON.stringify({ ...BODY, id: 0, transferType: "out", transferAmount: 299000 }),
                },
            ],
        ])
        expect(print.mock.calls).toEqual([
            ["299 accepted"],
            ['sent id=0 content="NIVO8F3K2 chuyen tien" amount=299000'],
        ])
    })

    it.each([199, 300])("prints the response then refuses HTTP %i", async (status) => {
        const { simulation, post, print } = await build({}, status)

        await expect(simulation.run(["NIVO8F3K2", "299000"], { out: false })).rejects.toEqual(
            new SepaySimulationError({ code: SepaySimulationErrorCode.Refused, params: { status } }),
        )

        expect(post.mock.calls).toEqual([
            [
                {
                    url: "http://localhost:3000/api/sepay/webhook",
                    headers: { "Content-Type": "application/json", Authorization: "Apikey sepay-key" },
                    body: JSON.stringify({ ...BODY, transferAmount: 299000 }),
                },
            ],
        ])
        expect(print.mock.calls).toEqual([
            [`${status} accepted`],
            ['sent id=1791829230456 content="NIVO8F3K2 chuyen tien" amount=299000'],
        ])
    })

    it("propagates a failed post and prints no reply", async () => {
        const { simulation, post, print } = await build()
        const failure = new Error("connection refused")
        post.mockRejectedValue(failure)

        await expect(simulation.run(["NIVO8F3K2"], {})).rejects.toBe(failure)
        expect(post.mock.calls).toEqual([
            [
                {
                    url: "http://localhost:3000/api/sepay/webhook",
                    headers: { "Content-Type": "application/json", Authorization: "Apikey sepay-key" },
                    body: JSON.stringify(BODY),
                },
            ],
        ])
        expect(print).not.toHaveBeenCalled()
    })
})
