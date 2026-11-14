import { Field, ID, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** Words in the two languages of the owner. */
export class ConnectionFieldWordsType {
    /** Vietnamese. */
    @Field(() => String)
    vi!: string

    /** English. */
    @Field(() => String)
    en!: string
}

@ObjectType()
/** Declared text: the words of the back end, or the key of the web catalogue that holds them today. */
export class ConnectionTextType {
    /** The words, when the back end holds them; else null. */
    @Field(() => ConnectionFieldWordsType, { nullable: true })
    text!: ConnectionFieldWordsType | null

    /** The key of the web catalogue holding the words (`sepayConnection.liveConfirmBody`); else null. */
    @Field(() => String, { nullable: true })
    key!: string | null
}

@ObjectType()
/** One value a `choice` field takes. */
export class ConnectionFieldChoiceType {
    /** The value sent back. */
    @Field(() => String)
    value!: string

    /** Its words. */
    @Field(() => ConnectionFieldWordsType)
    label!: ConnectionFieldWordsType

    /** The question to ask before saving this value (going live), or null. */
    @Field(() => ConnectionTextType, { nullable: true })
    confirm!: ConnectionTextType | null
}

@ObjectType()
/** One field of the connection form, or one input of an action. */
export class ConnectionFieldType {
    /** The key a change names it by. */
    @Field(() => String)
    key!: string

    /** Its label. */
    @Field(() => ConnectionFieldWordsType)
    label!: ConnectionFieldWordsType

    /** `text`, `secret` (write-only), `choice` or `identity` (shown, never edited). */
    @Field(() => String)
    kind!: string

    /** True when it may not be left empty. */
    @Field(() => Boolean)
    required!: boolean

    /** The shortest value it takes, or null. */
    @Field(() => Int, { nullable: true })
    minLength!: number | null

    /** The longest value it takes, or null. */
    @Field(() => Int, { nullable: true })
    maxLength!: number | null

    /** The values of a `choice`; empty otherwise. */
    @Field(() => [ConnectionFieldChoiceType])
    choices!: ReadonlyArray<ConnectionFieldChoiceType>

    /** The list the choices come from (`banks`), so a page may draw each option richly; null for a list of its own. */
    @Field(() => String, { nullable: true })
    choiceSource!: string | null

    /** True when the choices are many and the page should let the person search them. */
    @Field(() => Boolean)
    searchable!: boolean

    /** True when the page offers to copy the value (an address to paste at the provider). */
    @Field(() => Boolean)
    copyable!: boolean

    /** Its current public value; always null for a secret and an action input. */
    @Field(() => String, { nullable: true })
    value!: string | null

    /** For a secret: whether one is sealed; null for every other kind. */
    @Field(() => Boolean, { nullable: true })
    sealed!: boolean | null

    /** True when the caller may change it here (an action input: may run the action). */
    @Field(() => Boolean)
    editable!: boolean

    /** What to know or do before filling it, or null. */
    @Field(() => ConnectionTextType, { nullable: true })
    guidance!: ConnectionTextType | null
}

@ObjectType()
/** One member of what an action answers. */
export class ConnectionActionMemberType {
    /** The key of the member. */
    @Field(() => String)
    key!: string

    /** Its label. */
    @Field(() => ConnectionFieldWordsType)
    label!: ConnectionFieldWordsType
}

@ObjectType()
/** One declared action of a connection beyond save and check. */
export class ConnectionActionType {
    /** The key a run names it by (`test_send`). */
    @Field(() => String)
    key!: string

    /** Its label. */
    @Field(() => ConnectionFieldWordsType)
    label!: ConnectionFieldWordsType

    /** True when the caller may run it. */
    @Field(() => Boolean)
    canRun!: boolean

    /** What the person gives it. */
    @Field(() => [ConnectionFieldType])
    inputs!: ReadonlyArray<ConnectionFieldType>

    /** What it answers. */
    @Field(() => [ConnectionActionMemberType])
    results!: ReadonlyArray<ConnectionActionMemberType>

    /** What to know before running it, or null. */
    @Field(() => ConnectionTextType, { nullable: true })
    guidance!: ConnectionTextType | null

    /** The question to ask before it runs, or null. */
    @Field(() => ConnectionTextType, { nullable: true })
    confirm!: ConnectionTextType | null
}

@ObjectType()
/** The connection form of one account: the one surface where it is configured. */
export class ConnectionFieldsType {
    /** The account. */
    @Field(() => ID)
    connectionId!: string

    /** Its provider key. */
    @Field(() => String)
    provider!: string

    /** Its display name. */
    @Field(() => String)
    displayName!: string

    /** True when the caller may rename it and change its editable fields. */
    @Field(() => Boolean)
    canEdit!: boolean

    /** False when the provider registered no writer: the whole form is read-only. */
    @Field(() => Boolean)
    writable!: boolean

    /** True when checking the connection asks the provider something. */
    @Field(() => Boolean)
    canTest!: boolean

    /** The fields, in the order the form draws them. */
    @Field(() => [ConnectionFieldType])
    fields!: ReadonlyArray<ConnectionFieldType>

    /** The actions beyond save and check. */
    @Field(() => [ConnectionActionType])
    actions!: ReadonlyArray<ConnectionActionType>

    /** What to know about the whole form, or null. */
    @Field(() => ConnectionTextType, { nullable: true })
    guidance!: ConnectionTextType | null
}
