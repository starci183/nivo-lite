import { channelOf } from "./supplier-channel.policy"

describe("channelOf", () => {
    it("keeps Zalo and phone", () => {
        expect(channelOf("zalo")).toBe("zalo")
        expect(channelOf("phone")).toBe("phone")
    })

    it("reads anything else as email", () => {
        expect(channelOf("email")).toBe("email")
        expect(channelOf("fax")).toBe("email")
    })
})
