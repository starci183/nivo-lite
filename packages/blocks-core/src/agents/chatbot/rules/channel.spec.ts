import { CHATBOT_CHANNELS, channelNameOf, channelOf } from "./channel"

describe("channelOf", () => {
    it("keeps every known channel", () => {
        expect(CHATBOT_CHANNELS.map(channelOf)).toEqual([...CHATBOT_CHANNELS])
    })

    it("reads an unknown or internal channel as website chat", () => {
        expect(channelOf("web")).toBe("website")
        expect(channelOf("")).toBe("website")
    })
})

describe("channelNameOf", () => {
    it("names each channel by its proper name", () => {
        expect(CHATBOT_CHANNELS.map(channelNameOf)).toEqual(["Telegram", "Zalo", "Facebook", "Instagram", "Website"])
    })

    it("names an unknown channel as the website", () => {
        expect(channelNameOf("sms")).toBe("Website")
    })
})
