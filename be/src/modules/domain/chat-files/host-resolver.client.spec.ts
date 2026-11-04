import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ChatFilesLogEvent } from "./chat-files.log-events"
import { HostResolverClient } from "./host-resolver.client"

const build = async () => {
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [HostResolverClient, { provide: LOGGER, useValue: logger }],
    }).compile()
    return { resolver: moduleRef.get(HostResolverClient), logger }
}

describe("HostResolverClient", () => {
    it("answers the address of an address literal as a connection target, in both families", async () => {
        const { resolver, logger } = await build()

        await expect(resolver.resolve("203.0.113.7")).resolves.toEqual([{ address: "203.0.113.7", family: 4 }])
        await expect(resolver.resolve("2001:db8::7")).resolves.toEqual([{ address: "2001:db8::7", family: 6 }])
        expect(logger.warn).not.toHaveBeenCalled()
    })

    it("answers nothing for a name that does not resolve, and logs it", async () => {
        const { resolver, logger } = await build()

        await expect(resolver.resolve("no-such-host.invalid")).resolves.toEqual([])

        expect(logger.warn.mock.calls).toEqual([[ChatFilesLogEvent.HostUnresolved, { host: "no-such-host.invalid" }]])
    })
})
