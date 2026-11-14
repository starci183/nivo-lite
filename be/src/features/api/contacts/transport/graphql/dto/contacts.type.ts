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
/** A file of a line of the conversation: an address, never the bytes; or a file the person sent that could not be fetched, with why. */
export class CustomerMessageFileType {
    /** Where the file is served from; null for a file that could not be fetched (`notKept` says why). */
    @Field(() => String, { nullable: true })
    url!: string | null

    /**
     * Why a file the person sent could not be fetched and kept (`no_address`, `no_store`, `refused_<status>`, `store_failed`,
     * `fetch_failed`); null for a kept file. A reader shows the "could not be fetched" state for it.
     */
    @Field(() => String, { nullable: true })
    notKept!: string | null

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

@ObjectType()
/** The agent whose workbench holds a route's conversation now. */
export class ContactRouteWorkbenchType {
    /** The agent that spoke last on the route. */
    @Field(() => ID)
    agentId!: string

    /** The agent's display name. */
    @Field(() => String)
    agentName!: string

    /** The key of the agent's module. */
    @Field(() => String)
    moduleKey!: string

    /** The installation the agent runs as: with the module it names the workbench page. */
    @Field(() => ID)
    installationId!: string
}

@ObjectType()
/** The member of the shop who holds a route (the staff hold). */
export class ContactRouteHolderType {
    /** The membership id (the seat of the person in the workspace; never a user id). */
    @Field(() => ID)
    memberId!: string

    /** The member's display name, or null when the seat is gone. */
    @Field(() => String, { nullable: true })
    name!: string | null

    /** When the member took the thread over (ISO 8601). */
    @Field(() => String)
    at!: string
}

@ObjectType()
/** One route of a contact: this person on one account of one channel. */
export class ContactRouteType {
    /** The route. */
    @Field(() => ID)
    routeId!: string

    /** The channel (`zalo`, `telegram`, `website`, ...). */
    @Field(() => String)
    channel!: string

    /** The connection, site or API key of the entrance, or null. */
    @Field(() => ID, { nullable: true })
    accountId!: string | null

    /** The connection's name; null for an entrance that is no connection. */
    @Field(() => String, { nullable: true })
    accountName!: string | null

    /** The connection's provider; null for an entrance that is no connection. */
    @Field(() => String, { nullable: true })
    provider!: string | null

    /** When the newest line of the route was said (ISO 8601), or null when nothing was said on it. */
    @Field(() => String, { nullable: true })
    lastLineAt!: string | null

    /** The workbench of the agent that spoke last, or null when no agent has spoken on the route. */
    @Field(() => ContactRouteWorkbenchType, { nullable: true })
    workbench!: ContactRouteWorkbenchType | null

    /** The member who holds the thread, or null when the agents speak on it. */
    @Field(() => ContactRouteHolderType, { nullable: true })
    holder!: ContactRouteHolderType | null
}

@ObjectType()
/** Who spoke a line, resolved on the server. */
export class ContactMessageSpeakerType {
    /** `person` (the contact), `agent` (an agent, or the engine itself) or `staff` (a member of the shop). */
    @Field(() => String)
    kind!: string

    /** The name; null when none is known (the person has no name, the agent or the seat is gone, or the engine spoke). */
    @Field(() => String, { nullable: true })
    name!: string | null
}

@ObjectType()
/** One line of the whole conversation with a person (every route merged by time). */
export class ContactMessageType {
    /** The line. */
    @Field(() => ID)
    id!: string

    /** The route it was said on. */
    @Field(() => ID)
    routeId!: string

    /** The channel of the route. */
    @Field(() => String)
    channel!: string

    /** The connection, site or API key of the entrance, or null. */
    @Field(() => ID, { nullable: true })
    accountId!: string | null

    /** `from_person` (the person said it) or `to_person` (an agent or a person of the shop told it). */
    @Field(() => String)
    direction!: string

    /** When it was said (ISO 8601): the order of the thread. */
    @Field(() => String)
    saidAt!: string

    /** The words. */
    @Field(() => String)
    text!: string

    /** The files, by address. */
    @Field(() => [CustomerMessageFileType])
    files!: Array<CustomerMessageFileType>

    /** The order snapshot a sent line showed, as JSON text, or null. */
    @Field(() => String, { nullable: true })
    orderJson!: string | null

    /** A sent line's `claimed`, `delivered`, `refused` or `unknown`; null for what the person said. */
    @Field(() => String, { nullable: true })
    state!: string | null

    /** Who spoke it. */
    @Field(() => ContactMessageSpeakerType)
    speaker!: ContactMessageSpeakerType
}

@ObjectType()
/** A page of the whole conversation with a person, newest first, with the cursor of the older page. */
export class ContactMessagePageType {
    /** The lines. */
    @Field(() => [ContactMessageType])
    rows!: Array<ContactMessageType>

    /** The cursor of the next (older) page, or null at the end. */
    @Field(() => String, { nullable: true })
    next!: string | null
}

@ObjectType()
/** One thing an agent did for a person, in the words of the workspace. */
export class ContactWorkType {
    /** The memory entry. */
    @Field(() => ID)
    id!: string

    /** The workflow's title; null when the workflow no longer exists. */
    @Field(() => String, { nullable: true })
    workflowLabel!: string | null

    /** The step's title (the one its installed node declares); null when no installed node declares one. */
    @Field(() => String, { nullable: true })
    stepLabel!: string | null

    /** How the step ended: `done`, `failed` or `passed_over`. */
    @Field(() => String)
    status!: string

    /** The round of a loop the step ran in (data only, never a label); null for a step outside one. */
    @Field(() => Int, { nullable: true })
    round!: number | null

    /** When it ended (ISO 8601). */
    @Field(() => String)
    at!: string

    /** The agent that did it, or null. */
    @Field(() => ID, { nullable: true })
    agentId!: string | null

    /** The agent's name, or null. */
    @Field(() => String, { nullable: true })
    agentName!: string | null

    /** The run, or null. */
    @Field(() => ID, { nullable: true })
    runId!: string | null
}
