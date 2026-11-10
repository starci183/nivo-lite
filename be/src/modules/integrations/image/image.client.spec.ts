import { Test } from "@nestjs/testing"
import sharp from "sharp"
import { ImageErrorCode } from "./errors/image.error"
import { ImageClient } from "./image.client"

const build = async () => {
    const moduleRef = await Test.createTestingModule({ providers: [ImageClient] }).compile()
    return moduleRef.get(ImageClient)
}

const SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#3366cc"/></svg>'

describe("ImageClient", () => {
    it("draws an SVG document as a JPEG of the same size", async () => {
        const client = await build()

        const bytes = await client.rasterise(SVG)

        const meta = await sharp(bytes).metadata()
        expect(meta).toMatchObject({ format: "jpeg", width: 400, height: 300 })
    })

    it("cuts a photo to a square of the asked side", async () => {
        const client = await build()
        const photo = await client.rasterise(SVG)

        const cut = await client.cropSquare(photo, 120)

        expect(await sharp(cut).metadata()).toMatchObject({ format: "jpeg", width: 120, height: 120 })
    })

    it("rejects with a coded error for bytes that are no image", async () => {
        const client = await build()

        await expect(client.cropSquare(Buffer.from("not an image"), 100)).rejects.toMatchObject({
            code: ImageErrorCode.Failed,
        })
    })

    it("rejects with a coded error for a document that cannot be drawn", async () => {
        const client = await build()

        await expect(client.rasterise("<not-svg")).rejects.toMatchObject({ code: ImageErrorCode.Failed })
    })
})
