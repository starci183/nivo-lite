import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { NEW_CONTENT_MEDIA_UPLOAD_ID } from "./persistence/content-media.sql"
import type { ContentMediaUploadIdRow } from "./persistence/content-media.rows"
import { Injectable } from "@nestjs/common"
import { EntitlementsService } from "@modules/domain/billing"
import { VideoRendersService } from "@modules/domain/video-renders"
import type { CompletedRenderMedia } from "@modules/domain/video-renders"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { SupabaseObjectsPort } from "@modules/integrations/supabase"
import { ContentMediaError, ContentMediaErrorCode } from "./errors/content-media.error"
import type {
    ContentMediaData,
    ContentLibraryFile,
    ContentMediaRequest,
    ContentMediaUpload,
    MediaFile,
} from "./content-media.contracts"
import { InjectContentMediaStorage } from "./content-media.decorators"
import {
    buildContentMediaPath,
    CONTENT_MEDIA_BUCKET,
    displayName,
    isAcceptedMedia,
    isListableMedia,
    isWorkspaceMediaPath,
    withDownloadUrl,
} from "./media.policy"

/** Private preview addresses expire after one hour. */
const SIGN_SECONDS = 3600
/** The maximum number of attachment addresses on one editor screen. */
const URL_LIMIT = 80
/** Render output files live in a separate private bucket. */
const VIDEO_BUCKET = "videos"

@Injectable()
/** Proves workspace access before listing, signing or issuing an upload address for content attachments. */
export class ContentMediaService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectContentMediaStorage() private readonly storage: SupabaseObjectsPort,
        private readonly members: WorkspaceMembersService,
        private readonly renders: VideoRendersService,
        private readonly entitlements: EntitlementsService,
    ) {}

    /** Lists workspace media, newest first, for an active workspace member. */
    async library(userId: string, workspaceId: string, limit: number): Promise<ReadonlyArray<ContentLibraryFile>> {
        await this.members.require(userId, workspaceId)
        return this.listFiles(workspaceId, limit)
    }

    /** Lists attachable files and finished videos and signs the requested workspace attachments. */
    async read(userId: string, workspaceId: string, input: ContentMediaRequest): Promise<ContentMediaData> {
        await this.members.require(userId, workspaceId)
        if (input.paths.some((path) => !isWorkspaceMediaPath(workspaceId, path))) {
            throw new ContentMediaError({ code: ContentMediaErrorCode.PathInvalid })
        }
        const [library, videos, wantedVideos] = await Promise.all([
            this.listFiles(workspaceId, input.limit),
            this.renders.listCompletedMedia(workspaceId, 10),
            this.renders.findCompletedMedia(workspaceId, input.videoIds),
        ])
        const paths = [...new Set([...input.paths, ...library.map((file) => file.path)])].slice(0, URL_LIMIT)
        const safeVideos = wantedVideos.filter((video) => isWorkspaceMediaPath(workspaceId, video.outputPath))
        const [filesSigned, videosSigned] = await Promise.all([
            this.storage.signedUrls(CONTENT_MEDIA_BUCKET, paths, SIGN_SECONDS),
            this.storage.signedUrls(
                VIDEO_BUCKET,
                safeVideos.map((video) => video.outputPath),
                SIGN_SECONDS,
            ),
        ])
        if (filesSigned.kind !== "ok" || videosSigned.kind !== "ok") {
            throw new ContentMediaError({ code: ContentMediaErrorCode.StorageUnavailable })
        }
        const videoByPath = new Map<string, CompletedRenderMedia>(safeVideos.map((video) => [video.outputPath, video]))
        return {
            library,
            videos: videos.map((video) => ({
                id: video.id,
                name: video.title || "Video",
                createdAt: video.createdAt,
                durationMs: video.durationMs,
            })),
            urls: [
                ...filesSigned.value.map((file) => ({
                    key: file.path,
                    view: file.signedUrl,
                    download: withDownloadUrl(file.signedUrl, displayName(file.path.split("/").pop() ?? "file")),
                })),
                ...videosSigned.value.flatMap((file) => {
                    const video = videoByPath.get(file.path)
                    return video === undefined
                        ? []
                        : [
                              {
                                  key: `video:${video.id}`,
                                  view: file.signedUrl,
                                  download: withDownloadUrl(file.signedUrl, `${video.title || "video"}.mp4`),
                              },
                          ]
                }),
            ],
        }
    }

    /** Issues a unique workspace object upload address to an owner or manager. */
    async requestUpload(userId: string, workspaceId: string, file: MediaFile): Promise<ContentMediaUpload> {
        await this.members.require(userId, workspaceId, ["owner", "manager"])
        if (!isAcceptedMedia(file)) throw new ContentMediaError({ code: ContentMediaErrorCode.UploadInvalid })
        await this.entitlements.requireStorageFor(workspaceId, file.sizeBytes)
        const [allocated] = await this.entityManager.query<Array<ContentMediaUploadIdRow>>(NEW_CONTENT_MEDIA_UPLOAD_ID)
        if (allocated === undefined) throw new ContentMediaError({ code: ContentMediaErrorCode.StorageUnavailable })
        const path = buildContentMediaPath(workspaceId, file.name, allocated.id)
        const signed = await this.storage.signedUpload(CONTENT_MEDIA_BUCKET, path)
        if (signed.kind !== "ok") throw new ContentMediaError({ code: ContentMediaErrorCode.StorageUnavailable })
        return { ...signed.value, name: file.name }
    }

    private async listFiles(workspaceId: string, limit: number): Promise<ReadonlyArray<ContentLibraryFile>> {
        const listed = await this.storage.list(CONTENT_MEDIA_BUCKET, workspaceId, limit)
        if (listed.kind !== "ok") throw new ContentMediaError({ code: ContentMediaErrorCode.StorageUnavailable })
        return listed.value
            .filter(
                (file) =>
                    isListableMedia(file.name) && isWorkspaceMediaPath(workspaceId, `${workspaceId}/${file.name}`),
            )
            .map((file) => ({ kind: "media", path: `${workspaceId}/${file.name}`, name: displayName(file.name) }))
    }
}
