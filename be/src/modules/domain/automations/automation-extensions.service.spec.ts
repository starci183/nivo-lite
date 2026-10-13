import { mock } from "@starci/jest-preset"
import type { Logger } from "@modules/platform/logging"
import { AutomationExtensionsService } from "./automation-extensions.service"
import type { AutomationExtension, ExecutorContext, ScanContext } from "./automation-ports.contracts"
import { AutomationsLogEvent } from "./automations.log-events"
import { buildPipelineRow, buildShop, buildTemplate } from "@tests/fixtures/builders/automations.builder"

const build = () => {
    const logger = mock<Logger>()
    return { extensions: new AutomationExtensionsService(logger), logger }
}

const context: ScanContext = {
    workspaceId: "ws-1",
    pipeline: buildPipelineRow(),
    def: buildTemplate(),
    config: {},
    body: "",
    shop: buildShop(),
    now: new Date("2026-10-12T10:00:00.000Z"),
    batch: 8,
    trigger: () => Promise.resolve(),
}

describe("AutomationExtensionsService", () => {
    describe("executorOf", () => {
        it("finds the executor an extension registered for a template", () => {
            const { extensions } = build()
            const executor = (_context: ExecutorContext) => Promise.resolve({ status: "done" as const, steps: [] })
            extensions.add({})
            extensions.add({ executors: { thank_payment: executor } })

            expect(extensions.executorOf("thank_payment")).toBe(executor)
            expect(extensions.executorOf("other")).toBeUndefined()
        })
    })

    describe("scan", () => {
        it("lets the first extension that owns the template answer", async () => {
            const { extensions } = build()
            const first = jest.fn().mockResolvedValue(null)
            const owner = jest.fn().mockResolvedValue(3)
            const later = jest.fn().mockResolvedValue(9)
            extensions.add({})
            extensions.add({ scan: first })
            extensions.add({ scan: owner })
            extensions.add({ scan: later })

            await expect(extensions.scan(context)).resolves.toBe(3)

            expect(first).toHaveBeenCalledTimes(1)
            expect(later).not.toHaveBeenCalled()
        })

        it("answers none when no extension owns the template", async () => {
            const { extensions } = build()

            await expect(extensions.scan(context)).resolves.toBeNull()
        })
    })

    describe("tick", () => {
        it("adds up the work of every extension and logs a failing one without stopping the others", async () => {
            const { extensions, logger } = build()
            const failure = new Error("boom")
            extensions.add({})
            extensions.add({ tick: () => Promise.resolve(2) })
            extensions.add({ tick: () => Promise.reject(failure) })
            extensions.add({ tick: () => Promise.resolve(5) })

            await expect(extensions.tick(new Date("2026-10-12T10:00:00.000Z"))).resolves.toBe(7)

            expect(logger.error).toHaveBeenCalledWith(AutomationsLogEvent.ExtensionTickFailed, failure)
        })
    })

    describe("prepareEnable", () => {
        it("passes the config through every extension that prepares it", async () => {
            const { extensions } = build()
            const first: AutomationExtension = {
                prepareEnable: (_w, _u, _d, config) => Promise.resolve({ ...config, a: 1 }),
            }
            const second: AutomationExtension = {
                prepareEnable: (_w, _u, _d, config) => Promise.resolve({ ...config, b: 2 }),
            }
            extensions.add({})
            extensions.add(first)
            extensions.add(second)

            await expect(extensions.prepareEnable("ws-1", "u-1", buildTemplate(), { z: 0 })).resolves.toEqual({
                z: 0,
                a: 1,
                b: 2,
            })
        })
    })

    describe("googleAccounts", () => {
        it("collects the accounts of the extensions that know them", async () => {
            const { extensions } = build()
            const account = { id: "g-1", email: "a@b.c", status: "active" }
            extensions.add({})
            extensions.add({ googleAccounts: () => Promise.resolve([account]) })

            await expect(extensions.googleAccounts("ws-1")).resolves.toEqual([account])
        })
    })
})
