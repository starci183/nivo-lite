import { FakeClock, mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import type { Image } from "@modules/integrations/image"
import { REMOTE_FILES } from "@modules/integrations/remote-files"
import type { RemoteFiles } from "@modules/integrations/remote-files"
import type { StorageAssetsPort } from "@modules/integrations/object-storage"
import { CLOCK } from "@modules/platform/clock"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ChannelCollageService } from "./channel-collage.service"
import { CHANNELS_COLLAGE_STORAGE, CHANNELS_IMAGE, CHANNELS_PUBLIC_API_URL } from "./channels.decorators"
import { collageKeyOf, collagePathOf } from "./collage.policy"

const NOW = Date.parse("2026-11-09T10:00:00.000Z")
const DAY = 86_400_000
const DAY_NUMBER = String(Math.floor(NOW / DAY))
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0])

const images = [
    { url: "https://api.shop.vn/api/public/products/1/image", caption: "Basket\n2.000 VND" },
    { url: "https://api.shop.vn/api/public/products/2/image", caption: "Pot\n1.000 VND" },
    { url: "https://api.shop.vn/api/public/products/3/image", caption: "Seeds\n500 VND" },
]

/** The key the service names the collage of these images by: a photo without a version carries the day of the build. */
const keyOf = (list: ReadonlyArray<{ url: string; caption: string; version?: string }>): string =>
    collageKeyOf(list.map((image) => ({ ...image, version: image.version ?? DAY_NUMBER })))

/** The service with an in-memory store, a photo source and an image door that answers a JPEG; "none" leaves the API without a public address. */
const build = async (origin: "api" | "none" = "api") => {
    const files = new Map<string, Buffer>()
    const assets = mock<StorageAssetsPort>()
    assets.download.mockImplementation((bucket, path) => {
        const bytes = files.get(`${bucket}/${path}`)
        return Promise.resolve(
            bytes === undefined
                ? { data: null, error: new Error("missing") }
                : { data: new Blob([new Uint8Array(bytes)]), error: null },
        )
    })
    assets.upload.mockImplementation((bucket, path, body) => {
        files.set(`${bucket}/${path}`, body)
        return Promise.resolve({ error: null })
    })
    const remote = mock<RemoteFiles>()
    remote.read.mockResolvedValue({
        status: 200,
        contentType: "image/jpeg",
        location: undefined,
        length: 4,
        bytes: JPEG,
    })
    const image = mock<Image>()
    image.cropSquare.mockResolvedValue(JPEG)
    image.rasterise.mockResolvedValue(JPEG)
    const logger = mock<Logger>()
    const clock = new FakeClock(NOW)
    const publicApi =
        origin === "api"
            ? { provide: CHANNELS_PUBLIC_API_URL, useValue: "https://api.shop.vn" }
            : { provide: CHANNELS_PUBLIC_API_URL, useValue: "" }
    const moduleRef = await Test.createTestingModule({
        providers: [
            ChannelCollageService,
            { provide: CHANNELS_IMAGE, useValue: image },
            { provide: REMOTE_FILES, useValue: remote },
            { provide: CHANNELS_COLLAGE_STORAGE, useValue: assets },
            publicApi,
            { provide: LOGGER, useValue: logger },
            { provide: CLOCK, useValue: clock },
        ],
    }).compile()
    return { service: moduleRef.get(ChannelCollageService), remote, assets, files, logger, clock, image }
}

describe("ChannelCollageService build", () => {
    it("draws one JPEG of the cropped photos, keeps it under the name of the set and answers its public address", async () => {
        const { service, files, image } = await build()

        const url = await service.urlOf(images)

        const key = keyOf(images)
        expect(url).toBe(`https://api.shop.vn/api/public/collages/${key}`)
        expect(files.get(`media/${collagePathOf(key)}`)).toEqual(JPEG)
        expect(image.cropSquare).toHaveBeenCalledTimes(3)
        expect(image.rasterise).toHaveBeenCalledTimes(1)
        expect(image.rasterise.mock.calls[0]?.[0]).toContain("Basket")
    })

    it("keeps a grey tile where one photo cannot be read and still sends the others", async () => {
        const { service, remote, assets, image } = await build()
        remote.read.mockRejectedValueOnce(new Error("down"))

        await expect(service.urlOf(images)).resolves.not.toBeNull()

        expect(assets.upload).toHaveBeenCalledTimes(1)
        expect(image.cropSquare).toHaveBeenCalledTimes(2)
    })

    it("answers null and logs when no photo can be read, so the photos go one by one", async () => {
        const { service, remote, assets, logger } = await build()
        remote.read.mockResolvedValue({ status: 404, contentType: "", location: undefined, length: 0, bytes: null })

        await expect(service.urlOf(images)).resolves.toBeNull()

        expect(assets.upload).not.toHaveBeenCalled()
        expect(logger.warn).toHaveBeenCalledWith("channels.collage.failed", { reason: "no_photo_readable" })
    })

    it("answers null and logs when the store refuses the collage", async () => {
        const { service, assets, logger } = await build()
        assets.upload.mockResolvedValue({ error: new Error("store down") })

        await expect(service.urlOf(images)).resolves.toBeNull()

        expect(logger.error).toHaveBeenCalledWith("channels.collage.failed", expect.any(Error), {
            key: keyOf(images),
            code: "CHANNELS_COLLAGE_STORE_FAILED",
        })
    })

    it("builds nothing without a public address of the API or for fewer than two photos", async () => {
        const without = await build("none")
        const alone = await build()

        expect(without.service.canBuild()).toBe(false)
        expect(alone.service.canBuild()).toBe(true)
        await expect(without.service.urlOf(images)).resolves.toBeNull()
        await expect(alone.service.urlOf(images.slice(0, 1))).resolves.toBeNull()
        expect(without.assets.upload).not.toHaveBeenCalled()
        expect(alone.assets.upload).not.toHaveBeenCalled()
    })
})

describe("ChannelCollageService cache", () => {
    it("finds the same set again instead of building it twice", async () => {
        const { service, remote, assets } = await build()

        await service.urlOf(images)
        await service.urlOf(images)

        expect(assets.upload).toHaveBeenCalledTimes(1)
        expect(remote.read).toHaveBeenCalledTimes(3)
    })

    it("builds the collage again the next day for photos that carry no version, so a replaced photo shows up", async () => {
        const { service, assets, clock } = await build()

        await service.urlOf(images)
        clock.advance(DAY)
        await service.urlOf(images)

        expect(assets.upload).toHaveBeenCalledTimes(2)
    })

    it("builds a new collage when a version changes", async () => {
        const { service, assets } = await build()

        await service.urlOf(images)
        await service.urlOf(images.map((image, index) => (index === 0 ? { ...image, version: "2" } : image)))

        expect(assets.upload).toHaveBeenCalledTimes(2)
    })
})

describe("ChannelCollageService read", () => {
    it("serves a stored collage by its name and refuses a name that is no collage", async () => {
        const { service } = await build()
        await service.urlOf(images)

        const found = await service.read(keyOf(images))

        expect(found).toEqual({ bytes: JPEG, contentType: "image/jpeg" })
        await expect(service.read("../secret")).rejects.toMatchObject({ code: "CHANNELS_COLLAGE_NOT_FOUND" })
        await expect(service.read("a".repeat(64))).rejects.toMatchObject({ code: "CHANNELS_COLLAGE_NOT_FOUND" })
    })
})
