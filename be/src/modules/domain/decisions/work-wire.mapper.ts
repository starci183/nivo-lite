import type {
    CommandPayload,
    CommandPayloadInput,
    FieldRecord,
    FieldValue,
    OptionalFieldList,
    OptionalWireEdits,
} from "./work-decision.contracts"
import type { WorkEdits } from "./decisions.contracts"

/** Keeps the entries whose value is present, so an absent request property never overrides a stored value. */
const present = <T extends object>(entries: T): Partial<T> =>
    Object.entries(entries).reduce((kept, [key, value]) => (value === undefined ? kept : { ...kept, [key]: value }), {})

/** The record of named fields; a field with neither text nor number is empty. Nothing when no list is given. */
export const fieldRecordOf = (fields: OptionalFieldList): FieldRecord | undefined =>
    fields === undefined
        ? undefined
        : Object.fromEntries(fields.map((field: FieldValue) => [field.name, field.number ?? field.text ?? null]))

/** The edits the engine merges, from the edits a request carries. */
export const workEditsOf = (edits: OptionalWireEdits): WorkEdits =>
    edits === undefined
        ? {}
        : present({
              draft: edits.draft,
              amount_vnd: edits.amount_vnd,
              fields: fieldRecordOf(edits.fields),
              candidateId: edits.candidateId,
          })

/** The payload of a command: the named fields first, the ids over them so a field never redirects the item. */
export const commandPayloadOf = (input: CommandPayloadInput): CommandPayload => ({
    ...fieldRecordOf(input.fields),
    ...present({ subject_type: input.subjectType, subject_id: input.subjectId, lead_id: input.leadId }),
})
