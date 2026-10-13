import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the knowledge-sources capability. */
export enum KnowledgeSourcesErrorCode {
    /** No source of the workspace has the requested id. */
    SourceNotFound = "KNOWLEDGE_SOURCES_NOT_FOUND",
    /** The kind of a new source is not one of text, faq, file or url. */
    SourceKindUnknown = "KNOWLEDGE_SOURCES_KIND_UNKNOWN",
    /** A source needs a title and the request carries none. */
    TitleRequired = "KNOWLEDGE_SOURCES_TITLE_REQUIRED",
    /** A text or FAQ source has no content. */
    ContentEmpty = "KNOWLEDGE_SOURCES_CONTENT_EMPTY",
    /** The content is longer than a source may hold. */
    ContentTooLong = "KNOWLEDGE_SOURCES_CONTENT_TOO_LONG",
    /** A link source needs an http or https address. */
    UrlInvalid = "KNOWLEDGE_SOURCES_URL_INVALID",
    /** A file source names a storage path outside its workspace. */
    StoragePathInvalid = "KNOWLEDGE_SOURCES_STORAGE_PATH_INVALID",
    /** The agent instance a document is kept for does not belong to the workspace. */
    InstanceUnknown = "KNOWLEDGE_SOURCES_INSTANCE_UNKNOWN",
    /** The storage provider could not issue an upload address. */
    UploadUnavailable = "KNOWLEDGE_SOURCES_UPLOAD_UNAVAILABLE",
    /** The uploaded file name is empty. */
    FileNameRequired = "KNOWLEDGE_SOURCES_FILE_NAME_REQUIRED",
}

/** How each knowledge-sources code travels. */
export const KNOWLEDGE_SOURCES_ERROR_KINDS: Record<KnowledgeSourcesErrorCode, ErrorKind> = {
    [KnowledgeSourcesErrorCode.SourceNotFound]: "not-found",
    [KnowledgeSourcesErrorCode.SourceKindUnknown]: "invalid",
    [KnowledgeSourcesErrorCode.TitleRequired]: "invalid",
    [KnowledgeSourcesErrorCode.ContentEmpty]: "invalid",
    [KnowledgeSourcesErrorCode.ContentTooLong]: "invalid",
    [KnowledgeSourcesErrorCode.UrlInvalid]: "invalid",
    [KnowledgeSourcesErrorCode.StoragePathInvalid]: "invalid",
    [KnowledgeSourcesErrorCode.InstanceUnknown]: "invalid",
    [KnowledgeSourcesErrorCode.UploadUnavailable]: "unavailable",
    [KnowledgeSourcesErrorCode.FileNameRequired]: "invalid",
}

/** The one error class of the knowledge-sources capability. */
export class KnowledgeSourcesError extends DomainError<KnowledgeSourcesErrorCode> {}
