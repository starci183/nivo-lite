import { Field, ID, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/**
 * What a document IS (TRIAGE-2), judged once by the model for its text and shown on the document; the founder may answer otherwise
 * (`setKnowledgeSourceNature`). Only rule material is read into truths: a document of records, a log or reference material is stored
 * and searchable and files no truth.
 */
export class KnowledgeSourceNatureType {
    /** `rules` (the shop's own standing rules), `records` (a record table or export), `log` (a chat, diary, minutes, letters), `reference` (material about the trade the shop did not write as its rules) or `mixed` (judged by section). */
    @Field(() => String)
    nature!: string

    /** `model`, `founder` (his answer over the model's) or `fallback` (no readable answer: every passage was triaged one by one). */
    @Field(() => String)
    by!: string

    /** The model's one line of reason, in the document's language (kept when the founder answered). */
    @Field(() => String)
    reason!: string

    /** What the model said when the founder's answer replaced it; else null. */
    @Field(() => String, { nullable: true })
    modelNature?: string | null

    /** For a mixed document: how many of its sections (or parts) are rule material; else null. */
    @Field(() => Int, { nullable: true })
    ruleSections?: number | null

    /** For a mixed document: how many sections (or parts) it has; else null. */
    @Field(() => Int, { nullable: true })
    sections?: number | null

    /** Up to three quotes of the document the model's judgement rests on (TRIAGE-6). */
    @Field(() => [String], { nullable: true })
    evidence?: ReadonlyArray<string> | null

    /**
     * Documents of the same form (written to the same pattern) the model judged otherwise (TRIAGE-6): show the disagreement and let the
     * founder answer; while it stands, the one judged records / log / reference beside one judged rules is read as rules.
     */
    @Field(() => [ID], { nullable: true })
    disagreesWith?: ReadonlyArray<string> | null
}
