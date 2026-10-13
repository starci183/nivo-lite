import { SUBJECT_TYPES } from "@modules/domain/brain-facts"
import type { Scope, SubjectType } from "@modules/domain/brain-facts"
import type { FactDecision, FactForm, KeepCurrentInput, LessonDecision, LessonForm } from "./brain.contracts"
import { fieldsOf } from "./extraction.policy"

/** What an owner or manager can ask the back end to do from the Second Brain and Knowledge pages. */
export type BrainCommandKind =
    | "fact.save"
    | "fact.decide"
    | "fact.keep"
    | "lesson.save"
    | "lesson.decide"
    | "gap.dismiss"
    | "brain.maintain"
    | "lessons.mine"
    | "source.delete"
    | "source.reindex"
    | "source.update"
    | "knowledge.reembed"
    | "knowledge.ask"
    | "drive.linked"
    | "drive.picked"

/** The fields of a payload, read by name. */
type Payload = ReadonlyMap<string, unknown>

/** A document whose text is read again, optionally with new text. */
export interface ReindexCommand {
    /** The document. */
    readonly sourceId: string
    /** The new text; omitted keeps the text. */
    readonly content?: string
}

/** What changes about a document without reading it again. */
export interface UpdateCommand {
    /** The document. */
    readonly sourceId: string
    /** A new title. */
    readonly title?: string
    /** A new topic; an empty text clears it. */
    readonly topic?: string
    /** New tags. */
    readonly tags?: ReadonlyArray<string>
    /** A new module; an empty text means every module. */
    readonly module?: string
    /** public or internal. */
    readonly visibility?: string
}

/** A question to try against what the agents would retrieve. */
export interface AskCommand {
    /** The question. */
    readonly question: string
    /** The agent the question is asked as. */
    readonly module: string
    /** customer sees public passages only. */
    readonly audience: string
}

/** A Drive folder the owner picked in the Google Picker. */
export interface PickedCommand {
    /** The folder. */
    readonly folderId: string
    /** The short-lived token of the browser. */
    readonly token: string
}

/** A command after its payload was checked: the kind and exactly the fields that kind needs. */
export type BrainCommand =
    | { readonly kind: "fact.save"; readonly form: FactForm }
    | { readonly kind: "fact.decide"; readonly decision: Omit<FactDecision, "workspaceId"> }
    | { readonly kind: "fact.keep"; readonly keep: Omit<KeepCurrentInput, "workspaceId"> }
    | { readonly kind: "lesson.save"; readonly form: Omit<LessonForm, "workspaceId"> }
    | { readonly kind: "lesson.decide"; readonly decision: Omit<LessonDecision, "workspaceId"> }
    | { readonly kind: "gap.dismiss"; readonly id: string }
    | { readonly kind: "brain.maintain" }
    | { readonly kind: "lessons.mine"; readonly module: string }
    | { readonly kind: "source.delete"; readonly sourceId: string }
    | { readonly kind: "source.reindex"; readonly reindex: ReindexCommand }
    | { readonly kind: "source.update"; readonly update: UpdateCommand }
    | { readonly kind: "knowledge.reembed" }
    | { readonly kind: "knowledge.ask"; readonly ask: AskCommand }
    | { readonly kind: "drive.linked"; readonly url: string }
    | { readonly kind: "drive.picked"; readonly picked: PickedCommand }

/** A text field, or undefined when it is absent or not text. */
const text = (payload: Payload, name: string): string | undefined => {
    const value = payload.get(name)
    return typeof value === "string" ? value : undefined
}

/** A list of texts, or undefined when the field is absent or not a list of texts. */
const texts = (payload: Payload, name: string): ReadonlyArray<string> | undefined => {
    const value = payload.get(name)
    if (!Array.isArray(value)) return undefined
    return value.every((item) => typeof item === "string") ? value : undefined
}

/** A value that is one of the allowed texts, or undefined. */
const oneOf = <T extends string>(allowed: ReadonlyArray<T>, value: string | undefined): T | undefined =>
    allowed.find((item) => item === value)

const FACT_ACTIONS = ["apply", "reject", "choose", "split", "retire"] as const
const LESSON_ACTIONS = ["active", "rejected", "retired"] as const
const SCOPES: ReadonlyArray<Scope> = ["public", "internal", "restricted"]

/** The fact form of a payload. */
const factForm = (payload: Payload): FactForm | null => {
    const subjectType: SubjectType | undefined = oneOf(SUBJECT_TYPES, text(payload, "subjectType"))
    const scope = oneOf(SCOPES, text(payload, "scope"))
    const subjectLabel = text(payload, "subjectLabel")
    const attributeLabel = text(payload, "attributeLabel")
    const value = text(payload, "value")
    if (
        subjectType === undefined ||
        scope === undefined ||
        subjectLabel === undefined ||
        attributeLabel === undefined ||
        value === undefined
    ) {
        return null
    }
    return {
        subjectType,
        subjectLabel,
        attributeLabel,
        value,
        scope,
        modules: texts(payload, "modules") ?? [],
        validFrom: text(payload, "validFrom"),
        validTo: text(payload, "validTo"),
        note: text(payload, "note"),
        gapId: text(payload, "gapId"),
    }
}

/** The command of one kind, read from its payload. */
const read = (kind: BrainCommandKind, payload: Payload): BrainCommand | null => {
    const id = text(payload, "id")
    const sourceId = text(payload, "sourceId")
    switch (kind) {
        case "fact.save": {
            const form = factForm(payload)
            return form === null ? null : { kind, form }
        }
        case "fact.decide": {
            const action = oneOf(FACT_ACTIONS, text(payload, "action"))
            if (id === undefined || action === undefined) return null
            return {
                kind,
                decision: { id, action, note: text(payload, "note"), situation: text(payload, "situation") },
            }
        }
        case "fact.keep": {
            const subjectKey = text(payload, "subjectKey")
            const attribute = text(payload, "attribute")
            if (subjectKey === undefined || attribute === undefined) return null
            return { kind, keep: { subjectKey, attribute, installationId: text(payload, "installationId") } }
        }
        case "lesson.save": {
            const title = text(payload, "title")
            const body = text(payload, "body")
            if (title === undefined || body === undefined) return null
            return {
                kind,
                form: { module: text(payload, "module"), title, body, appliesWhen: text(payload, "appliesWhen") },
            }
        }
        case "lesson.decide": {
            const action = oneOf(LESSON_ACTIONS, text(payload, "action"))
            return id === undefined || action === undefined ? null : { kind, decision: { id, action } }
        }
        case "gap.dismiss":
            return id === undefined ? null : { kind, id }
        case "lessons.mine": {
            const module = text(payload, "module")
            return module === undefined ? null : { kind, module }
        }
        case "source.delete":
            return sourceId === undefined ? null : { kind, sourceId }
        case "source.reindex":
            return sourceId === undefined ? null : { kind, reindex: { sourceId, content: text(payload, "content") } }
        case "source.update":
            return sourceId === undefined
                ? null
                : {
                      kind,
                      update: {
                          sourceId,
                          title: text(payload, "title"),
                          topic: text(payload, "topic"),
                          tags: texts(payload, "tags"),
                          module: text(payload, "module"),
                          visibility: text(payload, "visibility"),
                      },
                  }
        case "knowledge.ask": {
            const question = text(payload, "question")
            const module = text(payload, "module")
            const audience = text(payload, "audience")
            if (question === undefined || module === undefined || audience === undefined) return null
            return { kind, ask: { question, module, audience } }
        }
        case "drive.linked": {
            const url = text(payload, "url")
            return url === undefined ? null : { kind, url }
        }
        case "drive.picked": {
            const folderId = text(payload, "folderId")
            const token = text(payload, "token")
            return folderId === undefined || token === undefined ? null : { kind, picked: { folderId, token } }
        }
        case "brain.maintain":
            return { kind }
        case "knowledge.reembed":
            return { kind }
    }
}

/** The kinds a command may have. */
export const COMMAND_KINDS: ReadonlyArray<BrainCommandKind> = [
    "fact.save",
    "fact.decide",
    "fact.keep",
    "lesson.save",
    "lesson.decide",
    "gap.dismiss",
    "brain.maintain",
    "lessons.mine",
    "source.delete",
    "source.reindex",
    "source.update",
    "knowledge.reembed",
    "knowledge.ask",
    "drive.linked",
    "drive.picked",
]

/** The command a row stands for, or null when its kind is unknown or its payload lacks what the kind needs. */
export const commandOf = (kind: string, payload: unknown): BrainCommand | null => {
    const known = oneOf(COMMAND_KINDS, kind)
    const fields = fieldsOf(payload)
    return known === undefined || fields === null ? null : read(known, fields)
}
