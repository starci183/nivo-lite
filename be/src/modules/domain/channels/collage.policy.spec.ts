import { Test } from "@nestjs/testing"
import {
    COLLAGE_MAX,
    collageColumnsOf,
    collageImagesOf,
    collageKeyOf,
    collageLabelsOf,
    collageLayoutOf,
    collagePathOf,
    collagePhotoSizeOf,
    collageSvgOf,
    collageUrlOf,
    isCollageKey,
    wrapLabel,
} from "./collage.policy"

const SUBJECT = Symbol("collage.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    collageColumnsOf,
                    collageImagesOf,
                    collageKeyOf,
                    collageLabelsOf,
                    collageLayoutOf,
                    collagePathOf,
                    collagePhotoSizeOf,
                    collageSvgOf,
                    collageUrlOf,
                    isCollageKey,
                    wrapLabel,
                },
            },
        ],
    }).compile()
    return moduleRef.get<typeof import("./collage.policy")>(SUBJECT)
}

const image = (index: number, version?: string) => ({
    url: `https://api/p/${index}/image`,
    caption: `Item ${index}\n${index * 1000} VND`,
    ...(version === undefined ? {} : { version }),
})

describe("collage layout", () => {
    it("puts two side by side, three across, four in a square, five and six in two rows of three", async () => {
        const subject = await build()

        expect([1, 2, 3, 4, 5, 6].map((count) => subject.collageColumnsOf(count))).toEqual([1, 2, 3, 2, 3, 3])
        expect(subject.collageLayoutOf(2)).toMatchObject({ columns: 2, rows: 1 })
        expect(subject.collageLayoutOf(3)).toMatchObject({ columns: 3, rows: 1 })
        expect(subject.collageLayoutOf(4)).toMatchObject({ columns: 2, rows: 2 })
        expect(subject.collageLayoutOf(5)).toMatchObject({ columns: 3, rows: 2 })
        expect(subject.collageLayoutOf(6)).toMatchObject({ columns: 3, rows: 2 })
    })

    it("holds at most six cells, however many photos are asked", async () => {
        const subject = await build()

        expect(subject.collageLayoutOf(9).tiles).toHaveLength(COLLAGE_MAX)
        expect(subject.collageImagesOf(Array.from({ length: 9 }, (_unused, index) => image(index)))).toHaveLength(6)
    })

    it("keeps every cell inside the image and no two cells on top of each other", async () => {
        const subject = await build()

        for (let count = 1; count <= 6; count += 1) {
            const layout = subject.collageLayoutOf(count)
            const cellHeight = (layout.tiles[0]?.size ?? 0) + layout.labelHeight
            for (const tile of layout.tiles) {
                expect(tile.x).toBeGreaterThanOrEqual(0)
                expect(tile.x + tile.size).toBeLessThanOrEqual(layout.width)
                expect(tile.y + cellHeight).toBeLessThanOrEqual(layout.height)
            }
            const spots = new Set(layout.tiles.map((tile) => `${tile.x},${tile.y}`))
            expect(spots.size).toBe(count)
        }
    })

    it("centres a last row that is not full", async () => {
        const subject = await build()
        const layout = subject.collageLayoutOf(5)
        const lastRow = layout.tiles.slice(3)
        const left = lastRow[0]?.x ?? 0
        const right = layout.width - ((lastRow[1]?.x ?? 0) + (lastRow[1]?.size ?? 0))

        expect(Math.abs(left - right)).toBeLessThanOrEqual(1)
    })

    it("keeps the image the same width and small enough to send", async () => {
        const subject = await build()

        for (let count = 2; count <= 6; count += 1) {
            const layout = subject.collageLayoutOf(count)
            expect(layout.width).toBe(1080)
            expect(layout.height).toBeLessThanOrEqual(1600)
            const tile = layout.tiles[0] ?? { x: 0, y: 0, size: 0 }
            expect(subject.collagePhotoSizeOf(tile)).toBeLessThan(tile.size)
        }
    })
})

describe("collage labels", () => {
    it("cuts a long name to two lines and ends the second with an ellipsis", async () => {
        const subject = await build()

        expect(subject.wrapLabel("Basket of mixed spring flowers with a long ribbon", 16, 2)).toEqual([
            "Basket of mixed",
            "spring flowers…",
        ])
        expect(subject.wrapLabel("Pot", 16, 2)).toEqual(["Pot"])
        expect(subject.wrapLabel("", 16, 2)).toEqual([])
    })

    it("cuts a word longer than a line", async () => {
        const subject = await build()

        expect(subject.wrapLabel("Supercalifragilistic", 8, 3)).toEqual(["Supercal", "ifragili", "stic"])
    })

    it("reads the name and the price of every photo from its caption", async () => {
        const subject = await build()
        const layout = subject.collageLayoutOf(2)

        expect(subject.collageLabelsOf([image(1), image(2)], layout)).toEqual([
            { nameLines: ["Item 1"], price: "1000 VND" },
            { nameLines: ["Item 2"], price: "2000 VND" },
        ])
    })
})

describe("collage svg", () => {
    it("draws a white page, a rounded tile per photo and a crimson price", async () => {
        const subject = await build()
        const layout = subject.collageLayoutOf(2)
        const svg = subject.collageSvgOf(layout, subject.collageLabelsOf([image(1), image(2)], layout), [
            "data:image/jpeg;base64,AAAA",
            null,
        ])

        expect(svg).toContain('fill="#ffffff"')
        expect(svg).toContain('fill="#e11d48"')
        expect(svg).toContain("Item 1")
        expect(svg.match(/rx="28"/gu)).toHaveLength(2)
        expect(svg).toContain("data:image/jpeg;base64,AAAA")
        expect(svg).toContain('fill="#f4f4f5"')
    })

    it("escapes the markup characters of a name", async () => {
        const subject = await build()
        const layout = subject.collageLayoutOf(2)
        const svg = subject.collageSvgOf(layout, [{ nameLines: ['Salt & <Pepper> "mix"'], price: "" }], [null, null])

        expect(svg).toContain("Salt &amp; &lt;Pepper&gt; &quot;mix&quot;")
        expect(svg).not.toContain("<Pepper>")
    })
})

describe("collage cache key", () => {
    it("is the same for the same photos, versions and words, and different for any change", async () => {
        const subject = await build()
        const set = [image(1, "a"), image(2, "a")]

        expect(subject.collageKeyOf(set)).toBe(subject.collageKeyOf([image(1, "a"), image(2, "a")]))
        expect(subject.collageKeyOf(set)).not.toBe(subject.collageKeyOf([image(1, "b"), image(2, "a")]))
        expect(subject.collageKeyOf(set)).not.toBe(subject.collageKeyOf([image(2, "a"), image(1, "a")]))
        expect(subject.collageKeyOf(set)).not.toBe(
            subject.collageKeyOf([image(1, "a"), { ...image(2, "a"), caption: "Item 2\n9 VND" }]),
        )
    })

    it("ignores a seventh photo, which the collage does not show", async () => {
        const subject = await build()
        const six = Array.from({ length: 6 }, (_unused, index) => image(index))

        expect(subject.collageKeyOf([...six, image(99)])).toBe(subject.collageKeyOf(six))
    })

    it("names a collage with a 64 digit hash and keeps it under the public catalogue folder", async () => {
        const subject = await build()
        const key = subject.collageKeyOf([image(1), image(2)])

        expect(subject.isCollageKey(key)).toBe(true)
        expect(subject.isCollageKey("../x")).toBe(false)
        expect(subject.isCollageKey(key.toUpperCase())).toBe(false)
        expect(subject.collagePathOf(key)).toBe(`catalogue-public/collages/${key}.jpg`)
    })

    it("builds the public address from the API origin, or none without one", async () => {
        const subject = await build()

        expect(subject.collageUrlOf("https://api.shop.vn/", "abc")).toBe("https://api.shop.vn/api/public/collages/abc")
        expect(subject.collageUrlOf("https://api.shop.vn", "abc")).toBe("https://api.shop.vn/api/public/collages/abc")
        expect(subject.collageUrlOf("", "abc")).toBeNull()
        expect(subject.collageUrlOf(undefined, "abc")).toBeNull()
    })
})
