import { Injectable } from "@nestjs/common"
import { StoredNote, KnowledgeSourcesService, SourceReadingsService } from "@modules/domain/knowledge-sources"
import type { SourceRecord } from "@modules/domain/knowledge-sources"
import { DocumentRefusalCode, InjectDocumentReaders } from "@modules/integrations/document-readers"
import type { DocumentReadersPort } from "@modules/integrations/document-readers"
import { InjectDocuments } from "@modules/integrations/documents"
import type { DocumentsPort } from "@modules/integrations/documents"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { ok, refused } from "@modules/platform/primitives"
import { DocumentTranscriptionService } from "./document-transcription.service"
import { InjectDriveAccessSource } from "./knowledge.decorators"
import type { DriveAccessSource, ReadOutcome } from "./knowledge.contracts"
import { noteOfRefusal, partsOfDocument, readingOfDocument, readingOfRefusal } from "./source-reading.policy"
import type { Say } from "./source-reading.policy"

/** The part of the text of a link without its scheme, lower case, for comparing a title with its address. */
const bare = (value: string): string => {
    const address = value.trim().replace(/^https?:\/\//iu, "")
    let end = address.length
    while (end > 0 && address[end - 1] === "/") end -= 1
    return address.slice(0, end).slice(0, 160).toLowerCase()
}

/** The name of an uploaded object, without its folders. */
const nameOf = (path: string): string => path.replace(/^.*\//u, "")

@Injectable()
/**
 * Turns a source into text by its kind: the note itself, an uploaded file (any kind of shop document, through the document readers),
 * or the page a link points to. Every reading of a file is recorded on the source (the reader, pages, sheets, what was transcribed from
 * a picture, the pages it could not read, and for a refused file the plain reason), for the second-brain page.
 */
export class SourceReaderService {
    constructor(
        @InjectDriveAccessSource() private readonly driveAccess: DriveAccessSource,
        @InjectDocuments() private readonly documents: DocumentsPort,
        @InjectDocumentReaders() private readonly readers: DocumentReadersPort,
        private readonly transcription: DocumentTranscriptionService,
        private readonly sources: KnowledgeSourcesService,
        private readonly readings: SourceReadingsService,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        @InjectClock() private readonly clock: Clock,
    ) {}

    /** The text of a source and the better title it may bring, or the stored code of why it cannot be read. */
    read(source: SourceRecord): Promise<ReadOutcome> {
        if (source.kind === "file") return this.readFile(source)
        if (source.kind === "url") return this.readLink(source)
        return Promise.resolve(ok({ text: source.content, title: null }))
    }

    /**
     * The text of an uploaded file: the bytes come from the private bucket and the document readers read them; a picture, or a page
     * of a PDF with no text layer, is transcribed through the AI (one call per page, paid by the workspace). A retry of the same
     * object whose text was transcribed reuses that text instead of paying for the pictures again.
     */
    private async readFile(source: SourceRecord): Promise<ReadOutcome> {
        const path = source.storagePath ?? ""
        if (path === "") {
            // A file source written by the old synchronous path already holds its text.
            return source.content.trim() === ""
                ? refused(StoredNote.FileMissing)
                : ok({ text: source.content, title: null })
        }
        const name = nameOf(path)
        if (!this.readers.acceptsName(name)) return this.refuse(source, DocumentRefusalCode.TypeUnsupported)
        const transcribed = await this.transcribedBefore(source, path)
        if (transcribed !== null) return ok({ text: transcribed, title: null })
        const stored = await this.sources.readUpload(path)
        if (stored === null) return refused(StoredNote.FileMissing)
        const read = await this.readers.read(
            { name, mime: stored.contentType, bytes: stored.bytes },
            { transcriber: this.transcription.transcriberFor(source.workspaceId) },
        )
        if (read.kind === "refused") return this.refuse(source, read.code)
        await this.readings.record(
            source.workspaceId,
            source.id,
            readingOfDocument(read.value, this.say, { path, at: this.clock.now() }),
        )
        const parts = partsOfDocument(read.value)
        return ok({ text: read.value.text, title: null, ...(parts === undefined ? {} : { parts }) })
    }

    /** The text a transcribed reading of this very object already gave, when the job runs again before it finished; else null. */
    private async transcribedBefore(source: SourceRecord, path: string): Promise<string | null> {
        if (source.content.trim() === "" || source.contentHash !== null) return null
        const reading = await this.readings.reading(source.workspaceId, source.id)
        const reusable = reading !== null && reading.transcribed && reading.refusal === null && reading.path === path
        return reusable ? source.content : null
    }

    /** Records why a file was refused, with its plain reason, and answers its stored note. */
    private async refuse(source: SourceRecord, code: DocumentRefusalCode): Promise<ReadOutcome> {
        await this.readings.record(
            source.workspaceId,
            source.id,
            readingOfRefusal(code, this.say, { path: source.storagePath, at: this.clock.now() }),
        )
        return refused(noteOfRefusal(code))
    }

    /** One catalog key in Vietnamese, the language of the owner's second-brain page. */
    private readonly say: Say = (key, params) => this.catalog.get(key, params, "vi")

    /** The text of a link; a page's own title replaces the title that was made from the address. */
    private async readLink(source: SourceRecord): Promise<ReadOutcome> {
        const url = (source.sourceUrl ?? source.content).trim()
        const drive = source.createdBy === null ? null : this.driveAccess.forWorkspace(source.workspaceId)
        const document = await this.documents.readLink(url, drive)
        const defaulted = source.title.trim() === "" || bare(source.title) === bare(url)
        return ok({
            text: document.text,
            title: defaulted && document.title !== null ? document.title.slice(0, 160) : null,
        })
    }
}
