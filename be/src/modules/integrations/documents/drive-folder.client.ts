import { Injectable } from "@nestjs/common"
import { eachInOrder } from "@modules/platform/primitives"
import type { DriveFile, DriveFolderListing } from "./documents.contracts"
import { InjectDocumentsOptions } from "./documents.decorators"
import type { DocumentsOptions } from "./documents.options"
import { DocumentsHttpClient } from "./documents-http.client"
import { DriveApiClient } from "./drive-api.client"
import { DRIVE_MIME, MAX_FOLDER_DEPTH, MAX_FOLDER_FILES, isDriveId } from "./drive-link.policy"
import { fileOf, joined, metaFrom } from "./drive-meta.mapper"
import type { DriveMeta, FolderVisit } from "./drive-meta.mapper"
import { DocumentsError, DocumentsErrorCode } from "./errors/documents.error"
import { fieldOf, listOf, textOf } from "./response-body.mapper"

/** The most shortcuts of one folder tree that are followed to their target. */
const MAX_SHORTCUT_LOOKUPS = 50

/** What every listing asks Drive to include. */
const LIVE = "supportsAllDrives=true&includeItemsFromAllDrives=true"

/** The fields a listing asks for. */
const LIST_FIELDS = "nextPageToken,files(id,name,mimeType,size,modifiedTime,shortcutDetails(targetId,targetMimeType))"

/** What one walk over a folder tree collects and remembers. */
interface FolderWalk {
    /** The files found, by id. */
    readonly files: Map<string, DriveFile>
    /** The folders already queued, so a folder reached twice is listed once. */
    readonly seenFolders: Set<string>
    /** The folders to list, in the order they were found. */
    readonly queue: Array<FolderVisit>
    /** True when the walk stopped at the depth or file limit. */
    truncated: boolean
    /** How many shortcuts were followed. */
    lookups: number
}

@Injectable()
/** Lists a Google Drive folder tree: its files, the folders below it and the targets of its shortcuts. */
export class DriveFolderClient {
    constructor(
        @InjectDocumentsOptions() private readonly options: DocumentsOptions,
        private readonly http: DocumentsHttpClient,
        private readonly api: DriveApiClient,
    ) {}

    /** Every file under a folder (folders themselves are not returned), with the folder's own name. */
    async listFolder(token: string, folderId: string): Promise<DriveFolderListing> {
        if (!isDriveId(folderId)) throw new DocumentsError({ code: DocumentsErrorCode.DriveIdInvalid })
        const root = await this.api.metaOf(token, folderId)
        if (root.mimeType !== DRIVE_MIME.folder) throw new DocumentsError({ code: DocumentsErrorCode.NotFolder })
        const walk: FolderWalk = {
            files: new Map(),
            seenFolders: new Set([folderId]),
            queue: [{ id: folderId, path: "", depth: 0 }],
            truncated: false,
            lookups: 0,
        }
        await this.walkFrom(token, walk, 0)
        return { name: root.name ?? folderId, files: [...walk.files.values()], truncated: walk.truncated }
    }

    /** Lists the queued folders from `index` on until the queue is empty or the walk is truncated. */
    private async walkFrom(token: string, walk: FolderWalk, index: number): Promise<void> {
        const visit = walk.queue[index]
        if (visit === undefined || walk.truncated) return
        await this.listPage(token, walk, visit, "")
        await this.walkFrom(token, walk, index + 1)
    }

    /** Lists one page of a folder, then the next page while Drive sends a page token. */
    private async listPage(token: string, walk: FolderWalk, visit: FolderVisit, pageToken: string): Promise<void> {
        const query = encodeURIComponent(`'${visit.id}' in parents and trashed=false`)
        const next = pageToken === "" ? "" : `&pageToken=${encodeURIComponent(pageToken)}`
        const url = `${this.options.driveBase}/files?q=${query}&fields=${encodeURIComponent(LIST_FIELDS)}&pageSize=200&orderBy=name&${LIVE}${next}`
        const page = this.http.jsonBody(await this.api.get(token, url))
        await eachInOrder(listOf(fieldOf(page, "files")), (item) => this.takeItem(token, walk, visit, metaFrom(item)))
        const following = textOf(fieldOf(page, "nextPageToken")) ?? ""
        if (following !== "" && !walk.truncated) await this.listPage(token, walk, visit, following)
    }

    /** Files go to the result, folders to the queue, shortcuts to their target. */
    private async takeItem(token: string, walk: FolderWalk, visit: FolderVisit, meta: DriveMeta): Promise<void> {
        if (meta.id === undefined) return
        if (meta.mimeType === DRIVE_MIME.folder) {
            this.enter(walk, meta.id, joined(visit.path, meta.name ?? meta.id), visit.depth + 1)
        } else if (meta.mimeType === DRIVE_MIME.shortcut) {
            await this.followShortcut(token, walk, visit, meta)
        } else {
            this.push(walk, fileOf(meta, meta.id, visit.path))
        }
    }

    /** Resolves a shortcut to its target, which is listed as a folder or a file; a target that does not open is skipped. */
    private async followShortcut(
        token: string,
        walk: FolderWalk,
        visit: FolderVisit,
        shortcut: DriveMeta,
    ): Promise<void> {
        const target = shortcut.targetId
        if (target === undefined || !isDriveId(target)) return
        walk.lookups += 1
        if (walk.lookups > MAX_SHORTCUT_LOOKUPS) return
        try {
            const meta = await this.api.metaOf(token, target)
            if (meta.trashed) return
            if (meta.mimeType === DRIVE_MIME.folder) {
                this.enter(walk, target, joined(visit.path, shortcut.name ?? meta.name ?? target), visit.depth + 1)
            } else this.push(walk, fileOf(meta, target, visit.path))
        } catch (cause) {
            // A shortcut whose target the token cannot open is skipped, but an expired token must still reach the caller.
            if (cause instanceof DocumentsError && cause.code === DocumentsErrorCode.TokenRejected) throw cause
        }
    }

    /** Queues a folder unless it is too deep or already seen. */
    private enter(walk: FolderWalk, id: string, path: string, depth: number): void {
        if (depth > MAX_FOLDER_DEPTH) walk.truncated = true
        else if (!walk.seenFolders.has(id)) {
            walk.seenFolders.add(id)
            walk.queue.push({ id, path, depth })
        }
    }

    /** Adds a file unless it was found already; past the file limit the walk is truncated. */
    private push(walk: FolderWalk, file: DriveFile): void {
        if (walk.files.has(file.id)) return
        if (walk.files.size >= MAX_FOLDER_FILES) walk.truncated = true
        else walk.files.set(file.id, file)
    }
}
