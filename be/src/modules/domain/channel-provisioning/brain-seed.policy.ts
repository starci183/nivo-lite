import { invalid, readSeedDocuments } from "./management-seed.policy"
import {
    BRAIN_SEED_SCHEMA,
    type BrainSeed,
    type BrainSeedDocument,
    type BrainSeedVisibility,
} from "./brain-seed.contracts"

const ORIGIN_PATTERN = /^seed:[a-z0-9][a-z0-9-]{0,39}$/u
const TITLE_MAX = 200
const TOPIC_MAX = 80
const MODULE_MAX = 60
/** The most characters one document may hold: the same bound the knowledge sources keep for a text. */
const CONTENT_MAX = 100_000

const isRecord = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === "object" && !Array.isArray(value)

const boundedText = (value: unknown, field: string, max: number): string =>
    typeof value === "string" && value.trim() !== "" && value.length <= max ? value.trim() : invalid(field)

const visibilityOf = (value: unknown): BrainSeedVisibility =>
    value === "public" || value === "internal" ? value : invalid("document.visibility")

const documentOf = (raw: unknown): BrainSeedDocument => {
    if (!isRecord(raw)) return invalid("document")
    return {
        title: boundedText(raw.title, "document.title", TITLE_MAX),
        topic: boundedText(raw.topic, "document.topic", TOPIC_MAX),
        visibility: visibilityOf(raw.visibility),
        module:
            raw.module === undefined || raw.module === null
                ? null
                : boundedText(raw.module, "document.module", MODULE_MAX),
        content: boundedText(raw.content, "document.content", CONTENT_MAX),
    }
}

const seedOf = (raw: unknown): BrainSeed => {
    if (!isRecord(raw) || raw.schema !== BRAIN_SEED_SCHEMA) return invalid("schema")
    const origin = typeof raw.origin === "string" && ORIGIN_PATTERN.test(raw.origin) ? raw.origin : invalid("origin")
    if (!Array.isArray(raw.documents) || raw.documents.length === 0) return invalid("documents")
    const documents = raw.documents.map((item) => documentOf(item))
    return new Set(documents.map((document) => document.title)).size === documents.length
        ? { origin, documents }
        : invalid("document.title")
}

/** The Brain seeds of the stack seed envelope, in order; a title given twice in one seed is refused, by the field's name. */
export const readBrainSeeds = (text: string): ReadonlyArray<BrainSeed> => readSeedDocuments(text).map((item) => seedOf(item))
