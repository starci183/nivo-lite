import { Field, ID, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One identity of a contact: how it is proven (`verifiedBy`: channel, token, member) and the merge reason that brought it (`joinedBy`). */
export class ContactIdentityType {
    /** The id of the record. */
    @Field(() => ID)
    id!: string

    /** `phone`, `email`, `channel` or `external`. */
    @Field(() => String)
    kind!: string

    /** The channel of a channel id (`zalo`, `telegram`); empty otherwise. */
    @Field(() => String)
    provider!: string

    /** The account (connection) of a channel id or an outside id; empty otherwise. */
    @Field(() => String)
    account!: string

    /** The normalised value. */
    @Field(() => String)
    value!: string

    /** True when proven; a self-declared phone or mail is a proposal (false). */
    @Field(() => Boolean)
    verified!: boolean

    /** How it was proven (`channel`, `token`, `member`); null when it is only a claim. */
    @Field(() => String, { nullable: true })
    verifiedBy!: string | null

    /** Where it was learned: `channel`, `step`, `member` or `form`. */
    @Field(() => String)
    source!: string

    /** The merge reason that brought it to this contact (`phone_verified`, `email_verified`, `link_token`, `member_approved`), or null. */
    @Field(() => String, { nullable: true })
    joinedBy!: string | null

    /** When it happened, as an ISO timestamp. */
    @Field(() => String)
    at!: string
}

@ObjectType()
/** One person the agents work with. No module field lives here: modules mount their own records as blocks. */
export class ContactType {
    /** The id of the record. */
    @Field(() => ID)
    id!: string

    /** The name the person is shown by; null when none is known. */
    @Field(() => String, { nullable: true })
    displayName!: string | null

    /** The tags a person put on the contact. */
    @Field(() => [String])
    tags!: Array<string>

    /** When the contact was created, as an ISO timestamp. */
    @Field(() => String)
    createdAt!: string

    /** When the contact last changed, as an ISO timestamp. */
    @Field(() => String)
    updatedAt!: string

    /** The identities of the contact. */
    @Field(() => [ContactIdentityType])
    identities!: Array<ContactIdentityType>
}

@ObjectType()
/** A page of contacts, newest first. */
export class ContactsPageType {
    /** The contacts of this page. */
    @Field(() => [ContactType])
    contacts!: Array<ContactType>

    /** The cursor of the next page; null on the last (and for a search). */
    @Field(() => String, { nullable: true })
    next!: string | null
}

@ObjectType()
/** One remembered fact; its value as JSON text. */
export class ContactMemoryFactType {
    /** The name of the remembered fact. */
    @Field(() => String)
    name!: string

    /** The value as it is stored. */
    @Field(() => String)
    value!: string
}

@ObjectType()
/** One remembered step outcome; its output as JSON text. */
export class ContactMemoryNoteType {
    /** The workflow that produced the outcome. */
    @Field(() => String)
    workflow!: string

    /** The step that produced the outcome. */
    @Field(() => String)
    step!: string

    /** How the step ended. */
    @Field(() => String)
    status!: string

    /** When it happened, as an ISO timestamp. */
    @Field(() => String)
    at!: string

    /** The step output as JSON text. */
    @Field(() => String)
    output!: string
}

@ObjectType()
/** What the agents remember of a contact. */
export class ContactMemoryType {
    /** The remembered facts. */
    @Field(() => [ContactMemoryFactType])
    facts!: Array<ContactMemoryFactType>

    /** The remembered step outcomes. */
    @Field(() => [ContactMemoryNoteType])
    notes!: Array<ContactMemoryNoteType>
}

@ObjectType()
/** "Maybe the same person": a suggestion only (`same_name`, `claimed_identity`), never applied by itself. */
export class ContactSuggestionType {
    /** The contact this refers to. */
    @Field(() => ID)
    contactId!: string

    /** The name the person is shown by; null when none is known. */
    @Field(() => String, { nullable: true })
    displayName!: string | null

    /** Why the contact is suggested (`same_name`, `claimed_identity`). */
    @Field(() => String)
    why!: string

    /** The kind of the claimed identity, or null. */
    @Field(() => String, { nullable: true })
    identityKind!: string | null

    /** The value of the claimed identity, or null. */
    @Field(() => String, { nullable: true })
    identityValue!: string | null
}

@ObjectType()
/** The detail of one contact. */
export class ContactDetailType {
    /** The contact. */
    @Field(() => ContactType)
    contact!: ContactType

    /** What the agents remember of the contact. */
    @Field(() => ContactMemoryType)
    memory!: ContactMemoryType

    /** The suggestions of possible duplicates; never applied by themselves. */
    @Field(() => [ContactSuggestionType])
    suggestions!: Array<ContactSuggestionType>
}

@ObjectType()
/** What linking an identity came to: `linked` (verified), `proposed` (a claim) or `merged` (into `contactId`). */
export class LinkContactIdentityType {
    /** What linking came to: `linked`, `proposed` or `merged`. */
    @Field(() => String)
    outcome!: string

    /** The contact this refers to. */
    @Field(() => ID)
    contactId!: string
}

@ObjectType()
/** One block of an agent's module on the contact detail: the generic block as a spec node, and the first rows its read gave for the person. */
export class ContactModuleBlockType {
    /** The block's id within its module. */
    @Field(() => String)
    id!: string

    /** The block's title in the viewer's language. */
    @Field(() => String)
    title!: string

    /** The spec node (block id, props, its slot bound to the module's read with the contact id), as JSON text. */
    @Field(() => String)
    nodeJson!: string

    /** What the read answered for the contact (`{ rows, cursor }`, the first rows only), as JSON text. */
    @Field(() => String)
    dataJson!: string

    /** The rows answered. */
    @Field(() => Int)
    count!: number

    /** Whether the person has rows beyond those answered. */
    @Field(() => Boolean)
    hasMore!: boolean
}

@ObjectType()
/** What one installed agent knows about the contact. */
export class ContactModuleAgentType {
    /** The installation the agent runs as. */
    @Field(() => ID)
    installationId!: string

    /** The agent; null when the installation has none. */
    @Field(() => ID, { nullable: true })
    agentId!: string | null

    /** The agent's display name. */
    @Field(() => String)
    agentName!: string

    /** The key of the agent's module. */
    @Field(() => String)
    moduleKey!: string

    /** The blocks of its module the member may see. */
    @Field(() => [ContactModuleBlockType])
    blocks!: Array<ContactModuleBlockType>
}

@ObjectType()
/** A file of a line of the conversation: an address, never the bytes. */
export class CustomerMessageFileType {
    /** Where the file is served from. */
    @Field(() => String)
    url!: string

    /** The name of the file, or empty. */
    @Field(() => String)
    name!: string

    /** The media type, or empty when the sender did not say. */
    @Field(() => String)
    contentType!: string

    /** The caption a sent picture carried, or null. */
    @Field(() => String, { nullable: true })
    caption!: string | null
}

@ObjectType()
/** One line of the conversation with a person on a route (owner ruling R26: engine data, both directions). */
export class CustomerMessageType {
    /** The line. */
    @Field(() => ID)
    id!: string

    /** The route it was said on. */
    @Field(() => ID)
    routeId!: string

    /** The person, as their id was when it was said. */
    @Field(() => ID)
    contactId!: string

    /** `from_person` (the person said it) or `to_person` (an agent or a person of the shop told it). */
    @Field(() => String)
    direction!: string

    /** The words. */
    @Field(() => String)
    text!: string

    /** When it was said (ISO 8601): the order of the thread. */
    @Field(() => String)
    saidAt!: string

    /** The files, by address. */
    @Field(() => [CustomerMessageFileType])
    files!: Array<CustomerMessageFileType>

    /** The order snapshot a sent line showed, as JSON text, or null. */
    @Field(() => String, { nullable: true })
    orderJson!: string | null

    /** The agent that told a sent line, or null. */
    @Field(() => ID, { nullable: true })
    agentId!: string | null

    /** The member of the shop who typed a sent line, or null. */
    @Field(() => ID, { nullable: true })
    memberId!: string | null

    /** A sent line's `claimed`, `delivered`, `refused` or `unknown`; null for what the person said. */
    @Field(() => String, { nullable: true })
    state!: string | null

    /** Why a sent line was refused, or what is known of an unknown outcome; null otherwise. */
    @Field(() => String, { nullable: true })
    reason!: string | null

    /** The channel. */
    @Field(() => String)
    channel!: string

    /** The connection, site or API key of the entrance, or null. */
    @Field(() => ID, { nullable: true })
    accountId!: string | null

    /** When the provider took a sent line (ISO 8601), or null. */
    @Field(() => String, { nullable: true })
    deliveredAt!: string | null
}

@ObjectType()
/** A page of the conversation, newest first, with the cursor of the older page. */
export class CustomerMessagePageType {
    /** The lines. */
    @Field(() => [CustomerMessageType])
    rows!: Array<CustomerMessageType>

    /** The cursor of the next (older) page, or null at the end. */
    @Field(() => String, { nullable: true })
    next!: string | null
}
