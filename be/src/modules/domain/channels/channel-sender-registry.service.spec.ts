import { ChannelSenderRegistryService } from "./channel-sender-registry.service"
import type { ChannelSender } from "./channels.contracts"

const senderFor = (...channels: Array<string>): ChannelSender => ({ channels, send: () => Promise.resolve(true) })

describe("ChannelSenderRegistryService", () => {
    it("serves every channel a sender names and nothing else", () => {
        const registry = new ChannelSenderRegistryService()
        const meta = senderFor("facebook", "instagram")

        registry.add(meta)

        expect(registry.get("facebook")).toBe(meta)
        expect(registry.get("instagram")).toBe(meta)
        expect(registry.get("telegram")).toBeUndefined()
    })

    it("lets a later registration replace an earlier one", () => {
        const registry = new ChannelSenderRegistryService()
        const second = senderFor("facebook")

        registry.add(senderFor("facebook"))
        registry.add(second)

        expect(registry.get("facebook")).toBe(second)
    })
})
