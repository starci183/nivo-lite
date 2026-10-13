import { Injectable } from "@nestjs/common"
import { MAX_UPLOAD_BYTES, StoredNote, KnowledgeSourcesService } from "@modules/domain/knowledge-sources"
import type { SourceRecord } from "@modules/domain/knowledge-sources"
import { DocumentsErrorCode, InjectDocuments } from "@modules/integrations/documents"
import type { DocumentsPort } from "@modules/integrations/documents"
import { ok, refused } from "@modules/platform/primitives"
import { InjectKnowledgeOptions } from "./knowledge.decorators"
import type { KnowledgeOptions } from "./knowledge.options"
import type { ReadOutcome } from "./knowledge.contracts"

/** The part of the text of a link without its scheme, lower case, for comparing a title with its address. */
const bare = (value: string): string =>
    value
        .trim()
        .replace(/^https?:\/\//iu, "")
        .replace(/\/+$/u, "")
        .slice(0, 160)
        .toLowerCase()

/** The name of an uploaded object, without its folders. */
const nameOf = (path: string): string => path.replace(/^.*\//u, "")

@Injectable()
/** Turns a source into text by its kind: the note itself, an uploaded file, or the page a link points to. */
export class SourceReaderService {
    constructor(
        @InjectKnowledgeOptions() private readonly options: KnowledgeOptions,
        @InjectDocuments() private readonly documents: DocumentsPort,
        private readonly sources: KnowledgeSourcesService,
    ) {}

    /** The text of a source and the better title it may bring, or the stored code of why it cannot be read. */
    read(source: SourceRecord): Promise<ReadOutcome> {
        if (source.kind === "file") return this.readFile(source)
        if (source.kind === "url") return this.readLink(source)
        return Promise.resolve(ok({ text: source.content, title: null }))
    }

    /** The text of an uploaded file: the bytes come from the private bucket, the name decides the kind. */
    private async readFile(source: SourceRecord): Promise<ReadOutcome> {
        const path = source.storagePath ?? ""
        if (path === "") {
            // A file source written by the old synchronous path already holds its text.
            return source.content.trim() === ""
                ? refused(StoredNote.FileMissing)
                : ok({ text: source.content, title: null })
        }
        const name = nameOf(path)
        if (!this.documents.canReadFileName(name)) return refused(DocumentsErrorCode.TypeUnsupported)
        const stored = await this.sources.readUpload(path)
        if (stored === null) return refused(StoredNote.FileMissing)
        if (stored.bytes.length > MAX_UPLOAD_BYTES) return refused(StoredNote.FileTooLarge)
        return ok({ text: await this.documents.readFile(name, stored.bytes, stored.contentType), title: null })
    }

    /** The text of a link; a page's own title replaces the title that was made from the address. */
    private async readLink(source: SourceRecord): Promise<ReadOutcome> {
        const url = (source.sourceUrl ?? source.content).trim()
        const drive = source.createdBy === null ? null : this.options.driveAccess.forWorkspace(source.workspaceId)
        const document = await this.documents.readLink(url, drive)
        const defaulted = source.title.trim() === "" || bare(source.title) === bare(url)
        return ok({
            text: document.text,
            title: defaulted && document.title !== null ? document.title.slice(0, 160) : null,
        })
    }
}
