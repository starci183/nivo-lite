import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { basename, join } from "node:path"
import { Injectable } from "@nestjs/common"
import { MEDIA_BUCKET } from "@modules/domain/video"
import { eachInOrder } from "@modules/platform/primitives"
import { InjectStorageObjects } from "@modules/integrations/object-storage"
import type { StorageObjectsPort } from "@modules/integrations/object-storage"
import { InjectFfmpeg } from "@modules/integrations/ffmpeg"
import type { Ffmpeg } from "@modules/integrations/ffmpeg"
import { ContentAiError, ContentAiErrorCode } from "./errors/content-ai.error"
import { IMAGE_HEIGHT, IMAGE_WIDTH, imageArgs, imageStylesOf, wrapText } from "./brand-image.policy"
import type { GuidelineKit, ImageCopy } from "./content-agent.contracts"
import type { DraftImage } from "./marketing-cards.contracts"
import { InjectContentAiOptions, InjectMarketingAssets } from "./content-agent.decorators"
import type { ContentAiOptions } from "./content-ai.options"
import type { MarketingAssets } from "./content-agent.port"

const PHOTO = /\.(jpe?g|png|webp)$/iu
const COMPOSE_TIMEOUT_MS = 60_000
const SIGN_SECONDS = 7 * 24 * 3600

/** What composing a draft's images needs. */
export interface ComposeRequest {
    /** The workspace. */
    readonly workspaceId: string
    /** The id the images are stored under (the content item). */
    readonly key: string
    /** The image texts. */
    readonly copies: ReadonlyArray<ImageCopy>
    /** The confirmed brand kit, or null. */
    readonly kit: GuidelineKit | null
    /** The workspace logo path in the media bucket, or null. */
    readonly logoPath: string | null
}

@Injectable()
/**
 * Composes the on-brand images of a draft with ffmpeg: the brand palette (light and dark variants), a photo of the workspace media
 * library on one half, the headline and the offer line in the bundled fonts and the logo; stores them in the media bucket.
 */
export class BrandImagesService {
    constructor(
        @InjectContentAiOptions() private readonly options: ContentAiOptions,
        @InjectStorageObjects() private readonly objects: StorageObjectsPort,
        @InjectMarketingAssets() private readonly assets: MarketingAssets,
        @InjectFfmpeg() private readonly ffmpeg: Ffmpeg,
    ) {}

    /** Composes and stores one image per copy (two at most); answers their stored paths. */
    async compose(request: ComposeRequest): Promise<ReadonlyArray<DraftImage>> {
        const dir = join(this.options.workDir, `marketing-${request.key}`)
        await mkdir(dir, { recursive: true })
        try {
            const photos = await this.photos(request.workspaceId, dir)
            const logo = request.logoPath === null ? null : await this.fetch(request.logoPath, join(dir, "logo"))
            const styles = imageStylesOf(request.kit)
            const images: Array<DraftImage> = []
            await eachInOrder([...request.copies.slice(0, 2).entries()], async ([index, copy]) => {
                const output = `image-${index + 1}.png`
                await writeFile(join(dir, `headline-${index}.txt`), wrapText(copy.headline, 16))
                await writeFile(join(dir, `subline-${index}.txt`), copy.subline)
                const controller = new AbortController()
                await this.ffmpeg.run(
                    "ffmpeg",
                    imageArgs({
                        photo: photos[index % Math.max(1, photos.length)] ?? null,
                        logo,
                        headlineFile: `headline-${index}.txt`,
                        sublineFile: `subline-${index}.txt`,
                        boldFont: join(this.options.fontsDir, "BeVietnamPro_700Bold.ttf"),
                        regularFont: join(this.options.fontsDir, "BeVietnamPro_400Regular.ttf"),
                        style: index === 0 ? styles[0] : styles[1],
                        output,
                    }),
                    { signal: controller.signal, cwd: dir, timeoutMs: COMPOSE_TIMEOUT_MS, urgent: true },
                )
                const path = `${request.workspaceId}/marketing/${request.key}-${index + 1}.png`
                const { error } = await this.assets.upload(
                    MEDIA_BUCKET,
                    path,
                    await readFile(join(dir, output)),
                    "image/png",
                )
                if (error !== null) throw new ContentAiError({ code: ContentAiErrorCode.Failed, cause: error })
                images.push({ path, width: IMAGE_WIDTH, height: IMAGE_HEIGHT })
            })
            return images
        } finally {
            await rm(dir, { recursive: true, force: true })
        }
    }

    /** Signed read urls of stored images, in the order asked (missing ones are left out). */
    async urlsOf(paths: ReadonlyArray<string>): Promise<ReadonlyArray<string>> {
        if (paths.length === 0) return []
        const signed = await this.objects.signedUrls(MEDIA_BUCKET, paths, SIGN_SECONDS)
        if (signed.kind !== "ok") return []
        const byPath = new Map(signed.value.map((entry) => [entry.path, entry.signedUrl]))
        return paths.flatMap((path) => {
            const url = byPath.get(path)
            return url === undefined ? [] : [url]
        })
    }

    /** Up to two photos of the workspace media library, downloaded into the work directory; none when the library is empty. */
    private async photos(workspaceId: string, dir: string): Promise<ReadonlyArray<string>> {
        const listed = await this.objects.list(MEDIA_BUCKET, workspaceId, 20)
        if (listed.kind !== "ok") return []
        const names = listed.value.map((file) => file.name).filter((name) => PHOTO.test(name))
        const files: Array<string> = []
        await eachInOrder([...names.slice(0, 2).entries()], async ([index, name]) => {
            const saved = await this.fetch(`${workspaceId}/${name}`, join(dir, `photo-${index}`))
            if (saved !== null) files.push(saved)
        })
        return files
    }

    /** Downloads one media object to `target`; answers the file name inside the work directory, or null when it is gone. */
    private async fetch(path: string, target: string): Promise<string | null> {
        const stored = await this.objects.download(MEDIA_BUCKET, path)
        if (stored.kind !== "ok") return null
        await writeFile(target, stored.value.bytes)
        return basename(target)
    }
}
