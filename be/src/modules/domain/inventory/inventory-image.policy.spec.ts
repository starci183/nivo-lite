import { Test } from "@nestjs/testing"
import { isPublicProductImage, productImagePathOf, productImageUrlOf } from "./inventory-image.policy"

const SUBJECT = Symbol("inventory-image.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { isPublicProductImage, productImagePathOf, productImageUrlOf } }],
    }).compile()
    return moduleRef.get<typeof import("./inventory-image.policy")>(SUBJECT)
}

describe("inventory image policy", () => {
    let policy: typeof import("./inventory-image.policy")

    beforeAll(async () => {
        policy = await build()
    })

    it("keeps the photo under the public product folder of the workspace, by the lower-cased sku and the extension of its type", () => {
        expect(policy.productImagePathOf("ws-1", "GIO-HOA-NHO", "image/jpeg")).toBe(
            "catalogue-public/ws-1/gio-hoa-nho.jpg",
        )
        expect(policy.productImagePathOf("ws-1", "A", "image/png")).toBe("catalogue-public/ws-1/a.png")
    })

    it("has no path for a content type no photo may have", () => {
        expect(policy.productImagePathOf("ws-1", "A", "image/gif")).toBeNull()
        expect(policy.productImagePathOf("ws-1", "A", "text/html")).toBeNull()
    })

    it("admits only paths of the public product folder, never a path that climbs out of it", () => {
        expect(policy.isPublicProductImage("catalogue-public/ws-1/a.jpg")).toBe(true)
        expect(policy.isPublicProductImage("hiring/cv.pdf")).toBe(false)
        expect(policy.isPublicProductImage("catalogue-public/../hiring/cv.pdf")).toBe(false)
        expect(policy.isPublicProductImage(null)).toBe(false)
    })

    it("builds the public address on the API address, without doubling the slash", () => {
        expect(policy.productImageUrlOf("https://api.example/", "item-1", "catalogue-public/ws/a.jpg")).toBe(
            "https://api.example/api/public/products/item-1/image",
        )
    })

    it("has none without an API address or a public photo", () => {
        expect(policy.productImageUrlOf("", "item-1", "catalogue-public/ws/a.jpg")).toBeNull()
        expect(policy.productImageUrlOf("https://api.example", "item-1", null)).toBeNull()
        expect(policy.productImageUrlOf("https://api.example", "item-1", "media/other.jpg")).toBeNull()
    })
})
