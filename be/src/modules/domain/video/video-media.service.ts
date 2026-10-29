import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { callDbFunction, InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectStorageObjects } from "@modules/integrations/object-storage"
import type { StorageObjectsPort } from "@modules/integrations/object-storage"
import { EntitlementsService } from "@modules/domain/billing"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { VideoError, VideoErrorCode } from "./errors/video.error"
import { MEDIA_BUCKET, MEDIA_MAX_BYTES, VIDEOS_BUCKET } from "./video-spec.policy"
import { mediaKindOf } from "./video-script.policy"
import type {
    MaybeWorkbenchRender,
    VideoMediaFile,
    VideoMediaItem,
    VideoMediaTicket,
} from "./video-workbench.contracts"
import type { MaybeStoredRender } from "./video-stored.contracts"
import { workspaceMediaPath } from "./video-workbench.policy"

const LINK_SECONDS = 3600
const MEDIA_MIME: ReadonlySet<string> = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "video/mp4",
    "video/quicktime",
    "video/webm",
])

@Injectable()
/** Private workspace media: bounded uploads and short lived previews and render downloads. */
export class VideoMediaService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectStorageObjects() private readonly storage: StorageObjectsPort,
        private readonly members: WorkspaceMembersService,
        private readonly entitlements: EntitlementsService,
    ) {}

    /** Lists a member's newest uploaded images and clips. */
    async list(principalId: string, workspaceId: string): Promise<ReadonlyArray<VideoMediaItem>> {
        await this.members.require(principalId, workspaceId)
        const listed = await this.storage.list(MEDIA_BUCKET, workspaceId, 60)
        if (listed.kind !== "ok")
            throw new VideoError({ code: VideoErrorCode.StorageFailed, params: { path: workspaceId } })
        const paths = listed.value
            .filter((file) => /\.(jpe?g|png|webp|mp4|mov|webm)$/iu.test(file.name))
            .map((file) => `${workspaceId}/${file.name}`)
        const signed = paths.length === 0 ? [] : await this.links(MEDIA_BUCKET, paths, LINK_SECONDS)
        const byPath = new Map(signed.map((entry) => [entry.path, entry.signedUrl]))
        return paths.map((path) => ({
            path,
            name: path.slice(workspaceId.length + 1).replace(/^[0-9a-f-]{36}-/iu, ""),
            kind: mediaKindOf(path),
            url: byPath.get(path) ?? null,
        }))
    }

    /** Gives a manager a one time address for a supported file within the workspace. */
    async createUpload(principalId: string, workspaceId: string, file: VideoMediaFile): Promise<VideoMediaTicket> {
        await this.members.require(principalId, workspaceId, ["owner", "manager"])
        if (!MEDIA_MIME.has(file.type) || file.size <= 0 || file.size > MEDIA_MAX_BYTES) {
            throw new VideoError({ code: VideoErrorCode.InputInvalid })
        }
        await this.entitlements.requireStorageFor(workspaceId, file.size)
        const filename =
            file.name
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/gu, "")
                .replace(/[^a-zA-Z0-9.-]+/gu, "-")
                .replace(/^[-.]+/u, "")
                .slice(-80) || "file"
        const [identity] = await callDbFunction<{ gen_random_uuid: string }>(this.entityManager, "gen_random_uuid", [])
        if (identity === undefined) {
            throw new VideoError({ code: VideoErrorCode.StorageFailed, params: { path: workspaceId } })
        }
        const path = `${workspaceId}/${identity.gen_random_uuid}-${filename}`
        const signed = await this.storage.signedUpload(MEDIA_BUCKET, path)
        if (signed.kind !== "ok") throw new VideoError({ code: VideoErrorCode.StorageFailed, params: { path } })
        return { path: signed.value.path, token: signed.value.token, signedUrl: signed.value.signedUrl }
    }

    /** Adds workspace checked playback addresses to a saved render. */
    async render(row: MaybeStoredRender, workspaceId: string, title: string): Promise<MaybeWorkbenchRender> {
        if (row === null) return null
        const paths =
            row.status === "done"
                ? [row.output_path, row.poster_path, row.captions_path ?? null].filter(
                      (path): path is string => path !== null && workspaceMediaPath(path, workspaceId),
                  )
                : []
        const urls = paths.length === 0 ? [] : await this.links(VIDEOS_BUCKET, paths, LINK_SECONDS)
        const byPath = new Map(urls.map((entry) => [entry.path, entry.signedUrl]))
        const videoUrl = row.output_path === null ? null : (byPath.get(row.output_path) ?? null)
        const captionsUrl =
            row.captions_path === null || row.captions_path === undefined
                ? null
                : (byPath.get(row.captions_path) ?? null)
        const download =
            title
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/gu, "")
                .replace(/[^a-zA-Z0-9]+/gu, "-")
                .slice(0, 80) || "video"
        return {
            id: row.id,
            status: row.status,
            progress: row.progress,
            stage: row.stage,
            durationMs: row.duration_ms,
            sizeBytes: row.size_bytes,
            errorCode: row.status === "failed" ? "VIDEO_RENDER_FAILED" : null,
            videoUrl,
            captionsUrl,
            captionsLang: captionsUrl === null ? null : (row.captions_lang ?? null),
            downloadUrl: videoUrl === null ? null : `${videoUrl}&download=${encodeURIComponent(download + ".mp4")}`,
            posterUrl: row.poster_path === null ? null : (byPath.get(row.poster_path) ?? null),
        }
    }

    /** A workspace pinned, three day download link for a completed render. */
    async shareLink(workspaceId: string, path: string): Promise<string> {
        if (!workspaceMediaPath(path, workspaceId)) throw new VideoError({ code: VideoErrorCode.InputInvalid })
        const [signed] = await this.links(VIDEOS_BUCKET, [path], 3 * 24 * 3600)
        if (signed === undefined) throw new VideoError({ code: VideoErrorCode.StorageFailed, params: { path } })
        return signed.signedUrl
    }

    private async links(bucket: string, paths: ReadonlyArray<string>, expiresIn: number) {
        const signed = await this.storage.signedUrls(bucket, paths, expiresIn)
        if (signed.kind !== "ok") throw new VideoError({ code: VideoErrorCode.StorageFailed, params: { path: bucket } })
        return signed.value
    }
}
