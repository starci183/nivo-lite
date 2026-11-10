import { Test } from "@nestjs/testing"
import {
    IMAGES_MAX,
    TELEGRAM_CAPTION_MAX,
    captionPartsOf,
    imageLinksOf,
    imageRouteOf,
    showsPictures,
    telegramCaptionOf,
} from "./channel-image.policy"

const SUBJECT = Symbol("channel-image.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: { imageRouteOf, showsPictures, captionPartsOf, telegramCaptionOf, imageLinksOf },
            },
        ],
    }).compile()
    return moduleRef.get<typeof import("./channel-image.policy")>(SUBJECT)
}

describe("imageRouteOf", () => {
    it("shows nothing when there is no picture", async () => {
        const subject = await build()

        expect(subject.imageRouteOf("zalo", 0, true)).toBe("none")
        expect(subject.imageRouteOf("telegram", 0, false)).toBe("none")
    })

    it("sends one picture as itself on a channel that shows pictures", async () => {
        const subject = await build()

        expect(subject.imageRouteOf("zalo", 1, true)).toBe("single")
        expect(subject.imageRouteOf("telegram", 1, false)).toBe("single")
    })

    it("lays several Zalo pictures into one collage when a collage can be built, else sends them one by one", async () => {
        const subject = await build()

        expect(subject.imageRouteOf("zalo", 5, true)).toBe("collage")
        expect(subject.imageRouteOf("zalo", 5, false)).toBe("each")
    })

    it("sends several Telegram pictures as one album whatever the collage", async () => {
        const subject = await build()

        expect(subject.imageRouteOf("telegram", 3, true)).toBe("album")
        expect(subject.imageRouteOf("telegram", 10, false)).toBe("album")
    })

    it("gives a channel that shows no pictures none, since its reply carries them as links", async () => {
        const subject = await build()

        expect(subject.imageRouteOf("website", 4, true)).toBe("none")
        expect(subject.imageRouteOf("facebook", 2, true)).toBe("none")
        expect(subject.showsPictures("zalo")).toBe(true)
        expect(subject.showsPictures("telegram")).toBe(true)
        expect(subject.showsPictures("website")).toBe(false)
    })

    it("holds as many pictures as one Telegram album does", () => {
        expect(IMAGES_MAX).toBe(10)
    })
})

describe("captions", () => {
    it("reads the name from the first line and the price from the rest", async () => {
        const subject = await build()

        expect(subject.captionPartsOf("Basket\n2.000 VND")).toEqual({ name: "Basket", price: "2.000 VND" })
        expect(subject.captionPartsOf("  Basket  ")).toEqual({ name: "Basket", price: "" })
        expect(subject.captionPartsOf("")).toEqual({ name: "", price: "" })
    })

    it("prints the Telegram caption as name then price, cut to what Telegram allows", async () => {
        const subject = await build()

        expect(subject.telegramCaptionOf("Basket\n2.000 VND")).toBe("Basket\n2.000 VND")
        expect(subject.telegramCaptionOf("x".repeat(TELEGRAM_CAPTION_MAX + 50))).toHaveLength(TELEGRAM_CAPTION_MAX)
    })

    it("turns pictures into one link line each for a channel that cannot show them", async () => {
        const subject = await build()

        expect(
            subject.imageLinksOf([
                { url: "https://x/1.jpg", caption: "Basket\n2.000 VND" },
                { url: "https://x/2.jpg", caption: "Pot" },
            ]),
        ).toEqual(["Basket - 2.000 VND: https://x/1.jpg", "Pot: https://x/2.jpg"])
    })
})
