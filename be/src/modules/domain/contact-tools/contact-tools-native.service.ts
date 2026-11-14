import { Injectable } from "@nestjs/common"
import {
    ContactsService,
    ConversationContactsService,
    maskedValueOf,
    type ContactActor,
    type ContactWithIdentities,
    type IdentityInput,
} from "@modules/domain/contacts"
import { CONTEXT_NOTICE, NOTE_ROWS, type ContextAudience, type ContextFact } from "@modules/domain/context-sources"
import { notesFor } from "@modules/domain/context-sources/context-sources.policy"
import { ConnectionBindingsReadService } from "@modules/domain/connections"
import {
    argumentsOf,
    unknownTool,
    type ToolJson,
    type NativeToolFamily,
    type NativeCaller,
    type ToolManifest,
} from "@modules/domain/tools"
import { nativeRefusal } from "@modules/domain/native-tools/native-refusal.policy"
import { OPENAPI_PROVIDER } from "@modules/domain/openapi-tools"
import { NativeViewService } from "@modules/domain/native-tools/native-view.service"
import { InjectClock, type Clock } from "@modules/platform/clock"
import type { JsonValue } from "@nivo-lite/agent-sdk/schema"
import {
    CONTACT_GET_INPUT_SCHEMA,
    CONTACT_GET_SCHEMA,
    CONTACT_LINK_INPUT_SCHEMA,
    CONTACT_LINK_SCHEMA,
    CONTACT_MERGE_INPUT_SCHEMA,
    CONTACT_MERGE_SCHEMA,
    CONTACT_REMEMBER_INPUT_SCHEMA,
    CONTACT_REMEMBER_SCHEMA,
    CONTACT_SEARCH_INPUT_SCHEMA,
    CONTACT_SEARCH_SCHEMA,
    CONTACT_UPDATE_INPUT_SCHEMA,
    CONTACT_UPDATE_SCHEMA,
} from "./contact-tools.schema"

/** The tools of the connector, by their own names (`nivo.tool.contact.<name>`). */
export const CONTACT_TOOL = {
    get: "get",
    search: "search",
    update: "update",
    remember: "memory.remember",
    link: "identity.link",
    merge: "merge",
} as const

/** The source a contact read answers as. */
const SOURCE = "nivo.contact"

/** The most accounts of a workspace looked at for the one an outside identity is linked on. */
const ACCOUNTS_MAX = 50

/** The contacts native connector: the engine's own person tools, each born with its final name. */
export const CONTACT_TOOLS_MANIFEST: ToolManifest = {
    key: "contacts",
    namespace: "nivo.tool.contact",
    name: "Contacts",
    contractVersion: "contacts@1",
    tools: [
        {
            name: CONTACT_TOOL.get,
            description:
                "The person (contact) this run serves: name, how they are reached (masked for a customer-facing run), tags and what the workflows remember of them. Takes no id.",
            scope: "read",
            defaultMode: "auto",
            inputSchema: CONTACT_GET_INPUT_SCHEMA,
            argumentSchema: CONTACT_GET_SCHEMA,
            secretFields: ["notice", "name", "phones", "emails", "memory", "notes"],
        },
        {
            name: CONTACT_TOOL.search,
            description:
                "Finds people of the workspace by an exact phone or mail address (any written form) or a name prefix, or one contact by its id. A lookup for internal work: it merges nobody.",
            scope: "read",
            defaultMode: "auto",
            inputSchema: CONTACT_SEARCH_INPUT_SCHEMA,
            argumentSchema: CONTACT_SEARCH_SCHEMA,
            secretFields: ["query", "contacts"],
            internalOnly: true,
        },
        {
            name: CONTACT_TOOL.update,
            description: "Changes the display name or the tags (the whole set) of the person this run serves.",
            scope: "write",
            defaultMode: "auto",
            inputSchema: CONTACT_UPDATE_INPUT_SCHEMA,
            argumentSchema: CONTACT_UPDATE_SCHEMA,
            secretFields: ["displayName"],
        },
        {
            name: CONTACT_TOOL.remember,
            description:
                "Remembers facts about the person this run serves (an address, a recipient, a date they care about); the newest value of a fact wins.",
            scope: "write",
            defaultMode: "auto",
            inputSchema: CONTACT_REMEMBER_INPUT_SCHEMA,
            argumentSchema: CONTACT_REMEMBER_SCHEMA,
            secretFields: ["facts"],
        },
        {
            name: CONTACT_TOOL.link,
            description:
                "Adds a way to reach the person: a phone or a mail address they gave (kept as a proposal until a person approves the call, which verifies it), the customer id an outside system gave for them on an account (internal runs only, a person approves), or a one-time link token they presented (it proves they are the contact it was issued for). Never worked out from a name.",
            scope: "write",
            defaultMode: "ask",
            inputSchema: CONTACT_LINK_INPUT_SCHEMA,
            argumentSchema: CONTACT_LINK_SCHEMA,
            secretFields: ["value", "token"],
        },
        {
            name: CONTACT_TOOL.merge,
            description:
                "Merges two contacts of the workspace into one (the first takes over every identity and the memory of the second). A person decides every merge.",
            scope: "write",
            defaultMode: "ask",
            inputSchema: CONTACT_MERGE_INPUT_SCHEMA,
            argumentSchema: CONTACT_MERGE_SCHEMA,
        },
    ],
}

/** The caller as these tools read it: the gateway's caller, and the person who approved this exact call, when one did. */
type ContactCaller = NativeCaller & { readonly approvedBy?: string | undefined }

/** Who decided a change a tool makes: the step's call, with the person who approved it when one did. */
const actorOf = (caller: ContactCaller): ContactActor => ({
    kind: "step",
    agentId: caller.agentId,
    stepKey: caller.opKey ?? null,
    approvedBy: caller.approvedBy === undefined || caller.approvedBy === "" ? null : caller.approvedBy,
})

/** A JSON value as the memory keeps it. */
const jsonOf = (value: unknown): JsonValue => structuredClone(value ?? null) as JsonValue

/** A run that speaks to a customer (a conversation, a customer origin): it may reach its own contact only. */
const servesCustomer = (caller: ContactCaller): boolean => caller.conversationId !== null || caller.run?.origin === "customer"

@Injectable()
/**
 * The contacts native connector (`nivo.tool.contact.*`): the engine's own tools about the people the agents work with. `get` is a
 * context read the door locks to the run's own contact. A write about a person reaches only the run's own contact when the run speaks to
 * a customer (`other_contact` otherwise). Identity rules are the contacts store's (exact verified match, link token, a person's approval;
 * a claim is a proposal); the tools add only the store's integrity and the internal-only rule of an outside system's identity.
 */
export class ContactToolsNativeService implements NativeToolFamily {
    readonly manifest: ToolManifest = CONTACT_TOOLS_MANIFEST

    constructor(
        private readonly contacts: ContactsService,
        private readonly conversations: ConversationContactsService,
        private readonly views: NativeViewService,
        private readonly bindings: ConnectionBindingsReadService,
        @InjectClock() private readonly clock: Clock,
    ) {}

    /** Runs one contact tool for the workspace and answers its result; an unknown tool is refused. */
    async invoke(workspaceId: string, tool: string, args: ToolJson, caller: ContactCaller): Promise<ToolJson> {
        switch (tool) {
            case CONTACT_TOOL.get:
                return this.get(workspaceId, args, caller)
            case CONTACT_TOOL.search:
                return this.search(workspaceId, args)
            case CONTACT_TOOL.update:
                return this.update(workspaceId, args, caller)
            case CONTACT_TOOL.remember:
                return this.remember(workspaceId, args, caller)
            case CONTACT_TOOL.link:
                return this.link(workspaceId, args, caller)
            case CONTACT_TOOL.merge:
                return this.merge(workspaceId, args, caller)
            default:
                throw unknownTool(tool)
        }
    }

    /** The run's own contact: the one the door filled, else the contact of the run's conversation; null when the run serves nobody. */
    private async ownContactOf(workspaceId: string, named: string | undefined, caller: ContactCaller): Promise<string | null> {
        const fromRun = caller.run?.contactId ?? null
        if (fromRun !== null) return fromRun
        if (caller.conversationId !== null) return this.conversations.contactOf(workspaceId, caller.conversationId)
        return named ?? null
    }

    /** The contact a write acts on: the one named (an internal run's choice) or the run's own; a customer-facing run reaches its own only. */
    private async targetOf(workspaceId: string, named: string | undefined, caller: ContactCaller): Promise<string> {
        const own = await this.ownContactOf(workspaceId, undefined, caller)
        if (servesCustomer(caller) || own !== null) {
            if (own === null) throw nativeRefusal("contact_missing")
            if (named !== undefined && (await this.contacts.current(workspaceId, named)) !== own) throw nativeRefusal("other_contact")
            return own
        }
        if (named === undefined) throw nativeRefusal("contact_missing")
        return named
    }

    private async get(workspaceId: string, args: ToolJson, caller: ContactCaller): Promise<ToolJson> {
        const asked = argumentsOf(CONTACT_TOOL.get, CONTACT_GET_SCHEMA, args)
        const audience: ContextAudience = (await this.views.of(workspaceId, caller)).audience
        const contactId = await this.ownContactOf(workspaceId, asked.contactId, caller)
        const contact = contactId === null ? null : await this.contacts.get(workspaceId, contactId)
        const facts: ReadonlyArray<ContextFact> = contact === null ? [] : [await this.factOf(workspaceId, contact, audience)]
        return { notice: CONTEXT_NOTICE, source: SOURCE, asOf: this.clock.now().toISOString(), facts: facts.map((fact) => ({ ...fact })) }
    }

    /** One contact as a read shows it to the audience: identities masked for a customer-facing run, notes of done steps only. */
    private async factOf(workspaceId: string, contact: ContactWithIdentities, audience: ContextAudience): Promise<ContextFact> {
        const memory = await this.contacts.memoryOf(workspaceId, contact.id, "step")
        const shown = (kind: string): ReadonlyArray<string> =>
            contact.identities
                .filter((one) => one.kind === kind)
                .map((one) => (audience === "customer" ? maskedValueOf(one) : one.value))
        return {
            id: contact.id,
            name: contact.displayName,
            phones: shown("phone"),
            emails: shown("email"),
            channels: [...new Set(contact.identities.filter((one) => one.kind === "channel").map((one) => one.provider))],
            tags: [...contact.tags],
            memory: memory.facts,
            notes: notesFor(memory.notes, audience, NOTE_ROWS.fallback),
            createdAt: contact.createdAt,
        }
    }

    private async search(workspaceId: string, args: ToolJson): Promise<ToolJson> {
        const asked = argumentsOf(CONTACT_TOOL.search, CONTACT_SEARCH_SCHEMA, args)
        const limit = asked.limit ?? 10
        const found = await this.foundBy(workspaceId, asked.contactId, asked.query, limit)
        const facts = await Promise.all(found.map((one) => this.factOf(workspaceId, one, "internal")))
        return { notice: CONTEXT_NOTICE, source: SOURCE, asOf: this.clock.now().toISOString(), facts: facts.map((fact) => ({ ...fact })) }
    }

    /** The contacts a search names: the one asked by id, else those the query finds, else none. */
    private async foundBy(
        workspaceId: string,
        contactId: string | undefined,
        query: string | undefined,
        limit: number,
    ): Promise<ReadonlyArray<ContactWithIdentities>> {
        if (contactId !== undefined) return [await this.contacts.get(workspaceId, contactId)].filter((one): one is ContactWithIdentities => one !== null)
        if (query === undefined) return []
        return this.contacts.search(workspaceId, query, limit)
    }

    private async update(workspaceId: string, args: ToolJson, caller: ContactCaller): Promise<ToolJson> {
        const asked = argumentsOf(CONTACT_TOOL.update, CONTACT_UPDATE_SCHEMA, args)
        const contactId = await this.targetOf(workspaceId, asked.contactId, caller)
        const outcome = await this.contacts.update(
            workspaceId,
            contactId,
            {
                ...(asked.displayName === undefined ? {} : { displayName: asked.displayName }),
                ...(asked.tags === undefined ? {} : { tags: asked.tags }),
            },
            actorOf(caller),
        )
        if (outcome.kind === "refused") throw nativeRefusal(outcome.reason)
        return { updated: true, contactId: outcome.contactId }
    }

    private async remember(workspaceId: string, args: ToolJson, caller: ContactCaller): Promise<ToolJson> {
        const asked = argumentsOf(CONTACT_TOOL.remember, CONTACT_REMEMBER_SCHEMA, args)
        const contactId = await this.targetOf(workspaceId, asked.contactId, caller)
        const facts = Object.fromEntries(Object.entries(asked.facts).map(([name, value]) => [name, jsonOf(value)]))
        if (!(await this.contacts.remember(workspaceId, contactId, facts))) throw nativeRefusal("contact_missing")
        return { remembered: Object.keys(facts), contactId }
    }

    private async link(workspaceId: string, args: ToolJson, caller: ContactCaller): Promise<ToolJson> {
        const asked = argumentsOf(CONTACT_TOOL.link, CONTACT_LINK_SCHEMA, args)
        const by = actorOf(caller)
        const approvedBy = by.kind === "step" ? by.approvedBy : null
        if (asked.kind === "external" && (caller.graphStep !== true || servesCustomer(caller))) throw nativeRefusal("internal_only")
        if (asked.kind === "external" && approvedBy === null) throw nativeRefusal("ask_only")
        const contactId = await this.targetOf(workspaceId, asked.contactId, caller)
        if (asked.token !== undefined) {
            const merged = await this.contacts.redeemLinkToken(workspaceId, contactId, asked.token, by)
            if (merged.kind === "refused") throw nativeRefusal(merged.reason === "no_proof" ? "token_invalid" : merged.reason)
            return { outcome: "merged", contactId: merged.contactId, reason: merged.reason }
        }
        if (asked.kind === undefined || asked.value === undefined) throw nativeRefusal("identity_invalid")
        const account = asked.kind === "external" ? await this.accountOf(workspaceId, asked.account) : undefined
        // A person who approved the call decided the identity (verified `member`); with no approval it is the person's own claim.
        const input: IdentityInput = {
            kind: asked.kind,
            value: asked.value,
            ...(account === undefined ? {} : { account }),
            ...(approvedBy === null ? {} : { proof: "member" as const }),
        }
        const outcome = await this.contacts.linkIdentity(workspaceId, contactId, input, by)
        if (outcome.kind === "refused") throw nativeRefusal(outcome.reason)
        if (outcome.kind === "merged") return { outcome: "merged", contactId: outcome.contactId, reason: outcome.reason }
        return {
            outcome: outcome.kind,
            contactId,
            identity: { id: outcome.identity.id, kind: outcome.identity.kind, verified: outcome.identity.verified },
        }
    }

    /**
     * The account an outside identity is linked on: an open account of the workspace that reads outside customers (the API account),
     * the one named, else the only one; none, or several and none named: `account_missing`.
     */
    private async accountOf(workspaceId: string, named: string | undefined): Promise<string> {
        const held = await this.bindings.ofProvider(workspaceId, OPENAPI_PROVIDER, ACCOUNTS_MAX)
        const open = held.filter((entry) => entry.status !== "disconnected")
        if (named !== undefined) {
            if (!open.some((entry) => entry.id === named)) throw nativeRefusal("account_missing")
            return named
        }
        const [only, ...others] = open
        if (only === undefined || others.length > 0) throw nativeRefusal("account_missing")
        return only.id
    }

    private async merge(workspaceId: string, args: ToolJson, caller: ContactCaller): Promise<ToolJson> {
        const asked = argumentsOf(CONTACT_TOOL.merge, CONTACT_MERGE_SCHEMA, args)
        const outcome = await this.contacts.merge(workspaceId, {
            into: asked.intoContactId,
            from: asked.fromContactId,
            by: actorOf(caller),
        })
        if (outcome.kind === "refused") throw nativeRefusal(outcome.reason)
        return { merged: true, contactId: outcome.contactId, reason: outcome.reason }
    }
}
