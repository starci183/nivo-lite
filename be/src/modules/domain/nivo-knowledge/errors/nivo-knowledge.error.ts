import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the nivo-knowledge capability. */
export enum NivoKnowledgeErrorCode {
    /** A base knowledge file has no front matter block. */
    FrontMatterMissing = "NIVO_KNOWLEDGE_FRONT_MATTER_MISSING",
    /** A base knowledge file sits in a folder that is not a module of the catalogue. */
    ModuleUnknown = "NIVO_KNOWLEDGE_MODULE_UNKNOWN",
    /** A base knowledge file declares a kind that is not one of the known kinds. */
    KindUnknown = "NIVO_KNOWLEDGE_KIND_UNKNOWN",
    /** A base knowledge file has no title. */
    TitleMissing = "NIVO_KNOWLEDGE_TITLE_MISSING",
    /** Two base knowledge files share a slug. */
    SlugDuplicate = "NIVO_KNOWLEDGE_SLUG_DUPLICATE",
}

/** How each nivo-knowledge code travels. */
export const NIVO_KNOWLEDGE_ERROR_KINDS: Record<NivoKnowledgeErrorCode, ErrorKind> = {
    [NivoKnowledgeErrorCode.FrontMatterMissing]: "invalid",
    [NivoKnowledgeErrorCode.ModuleUnknown]: "invalid",
    [NivoKnowledgeErrorCode.KindUnknown]: "invalid",
    [NivoKnowledgeErrorCode.TitleMissing]: "invalid",
    [NivoKnowledgeErrorCode.SlugDuplicate]: "invalid",
}

/** The one error class of the nivo-knowledge capability. */
export class NivoKnowledgeError extends DomainError<NivoKnowledgeErrorCode> {}
