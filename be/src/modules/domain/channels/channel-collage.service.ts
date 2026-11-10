import { Injectable } from "@nestjs/common"
import type { StorageAssetsPort } from "@modules/integrations/object-storage"
import type { Image } from "@modules/integrations/image"
import { InjectRemoteFiles } from "@modules/integrations/remote-files"
import type { RemoteFiles } from "@modules/integrations/remote-files"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { DomainError } from "@modules/platform/errors"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { ChannelImage, OptionalCollageBytes, OptionalCollageUrl, StoredCollage } from "./channel-image.contracts"
import { InjectChannelsCollageStorage, InjectChannelsImage, InjectChannelsPublicApiUrl } from "./channels.decorators"
import { ChannelsLogEvent } from "./channels.log-events"
import { ChannelsError, ChannelsErrorCode } from "./errors/channels.error"
import {
    COLLAGE_CONTENT_TYPE,
    collageImagesOf,
    collageKeyOf,
    collageLabelsOf,
    collageLayoutOf,
    collagePathOf,
    collagePhotoSizeOf,
    collageSvgOf,
    collageUrlOf,
    isCollageKey,
} from "./collage.policy"

/** The bucket collages are kept in: the folder that makes them public lives in it. */
const COLLAGE_BUCKET = "media"

/** The most bytes of one source photo, and how long to wait for it. */
const PHOTO_MAX_BYTES = 6_000_000
const PHOTO_TIMEOUT_MS = 8000
const DAY_MS = 86_400_000

/** The code of a failure for the log, or the word unknown. */
const codeOf = (cause: unknown): string => (cause instanceof DomainError ? String(cause.code) : "unknown")

@Injectable()
/**
 * Builds one image out of up to six catalogue photos (a white page, rounded tiles, the name and a crimson price under each photo), keeps it in
 * the media bucket under a name made of what it shows, and answers its public address. The same set of photos, versions and words is built once
 * and found again. It never throws on the way out: when the collage cannot be made (no public address, no photo could be read, the store
 * refused) it answers null and the caller sends the photos one by one.
 */
export class ChannelCollageService {
    private readonly stored = new Set<string>()

    constructor(
        @InjectClock() private readonly clock: Clock,
        @InjectLogger() private readonly logger: Logger,
        @InjectChannelsImage() private readonly image: Image,
        @InjectRemoteFiles() private readonly remote: RemoteFiles,
        @InjectChannelsCollageStorage() private readonly assets: StorageAssetsPort,
        @InjectChannelsPublicApiUrl() private readonly publicApiUrl: string,
    ) {}

    /** True when the API has a public address, so a collage could be read by the channel. */
    canBuild(): boolean {
        return collageUrlOf(this.publicApiUrl, "x") !== null
    }

    /** The public address of the collage of these pictures (the first six), built now when it is not stored yet; null when it cannot be made. */
    async urlOf(images: ReadonlyArray<ChannelImage>): Promise<OptionalCollageUrl> {
        const shown = collageImagesOf(images).map((image) => ({ ...image, version: image.version ?? this.dayOf() }))
        const key = collageKeyOf(shown)
        const url = collageUrlOf(this.publicApiUrl, key)
        if (url === null || shown.length < 2) return null
        try {
            if (this.stored.has(key) || (await this.exists(key))) {
                this.stored.add(key)
                return url
            }
            const bytes = await this.build(shown)
            if (bytes === null) return null
            const saved = await this.assets.upload(COLLAGE_BUCKET, collagePathOf(key), bytes, COLLAGE_CONTENT_TYPE)
            if (saved.error !== null) throw new ChannelsError({ code: ChannelsErrorCode.CollageStoreFailed })
            this.stored.add(key)
            return url
        } catch (cause) {
            this.logger.error(ChannelsLogEvent.CollageFailed, cause, { key, code: codeOf(cause) })
            return null
        }
    }

    /** The stored collage named `key`; a name that is no collage name, or a collage not stored, is not found. */
    async read(key: string): Promise<StoredCollage> {
        if (!isCollageKey(key)) throw new ChannelsError({ code: ChannelsErrorCode.CollageNotFound })
        const file = await this.assets.download(COLLAGE_BUCKET, collagePathOf(key))
        if (file.error !== null) throw new ChannelsError({ code: ChannelsErrorCode.CollageNotFound })
        return { bytes: Buffer.from(await file.data.arrayBuffer()), contentType: COLLAGE_CONTENT_TYPE }
    }

    /** The day a collage is built on, as a version for photos that carry none: a photo the shop replaces under the same address shows in a collage within a day, the same time the photo itself may be cached. */
    private dayOf(): string {
        return String(Math.floor(this.clock.now().getTime() / DAY_MS))
    }

    private async exists(key: string): Promise<boolean> {
        const file = await this.assets.download(COLLAGE_BUCKET, collagePathOf(key))
        return file.error === null
    }

    /** The JPEG of the collage; null when no photo could be read at all. */
    private async build(images: ReadonlyArray<ChannelImage>): Promise<OptionalCollageBytes> {
        const layout = collageLayoutOf(images.length)
        const photos = await Promise.all(
            images.map((image, index) => {
                const tile = layout.tiles[index]
                return tile === undefined ? Promise.resolve(null) : this.photoOf(image, collagePhotoSizeOf(tile))
            }),
        )
        if (photos.every((photo) => photo === null)) {
            this.logger.warn(ChannelsLogEvent.CollageFailed, { reason: "no_photo_readable" })
            return null
        }
        return this.image.rasterise(collageSvgOf(layout, collageLabelsOf(images, layout), photos))
    }

    /** One photo cropped to a square of `size` as a data address, or null when it cannot be read. */
    private async photoOf(image: ChannelImage, size: number): Promise<OptionalCollageUrl> {
        try {
            const answer = await this.remote.read({
                url: image.url,
                maxBytes: PHOTO_MAX_BYTES,
                timeoutMs: PHOTO_TIMEOUT_MS,
                accepts: (contentType) => contentType.toLowerCase().startsWith("image/"),
            })
            if (answer.bytes === null) return null
            const cut = await this.image.cropSquare(answer.bytes, size)
            return `data:image/jpeg;base64,${cut.toString("base64")}`
        } catch (cause) {
            this.logger.warn(ChannelsLogEvent.CollageFailed, { reason: "photo_unreadable", code: codeOf(cause) })
            return null
        }
    }
}
