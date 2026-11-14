import type { JsonObject } from "../schema/schema.types"
import type {
    ContactIdentityLinkRefusal,
    ContactMergeRefusal,
    ContactWriteRefusal,
    CustomerMessageSendRefusal,
    PinRefusal,
    PublishRefusal,
    FileGetRefusal,
    FileLinkRefusal,
    FilePutRefusal,
    RecordCreateRefusal,
    RecordGetRefusal,
    RecordListRefusal,
    RecordUpdateRefusal,
    VideoComposeRefusal,
    VideoRenderGetRefusal,
} from "./tool"

/**
 * The names of NIVO, in three levels (`nivo.api.*`, `nivo.tool.*`, `nivo.trigger.*`), and nothing else: no schema, no executor. The engine's
 * spec registries are TOTAL records over these names, so a name without a spec does not compile in the engine and a spec without a name
 * cannot be written. The law of a name is `isToolId` / `isTriggerVerb` / `isApiVerb` of `@nivo-lite/agent-sdk/schema`.
 */

/**
 * What a tool takes and answers, and the business refusals it answers (`{ ok: false, refusal }`). Every core tool is `JsonObject` →
 * `JsonObject` until the engine specs give each its own. `refusals` is `string` for a tool whose spec cannot enumerate its refusals (a
 * source's operation, a native read whose adapter answers free text); a tool whose engine spec holds a CLOSED set is declared `Refusing<…>`
 * with exactly that union (the engine's registry does not compile when the two differ).
 */
export interface ToolSignature {
    /** The arguments the tool takes. */
    readonly args: JsonObject
    /** What the tool answers when it succeeds. */
    readonly answer: JsonObject
    /** The business refusals the tool may answer: a closed union, or any string while the spec cannot enumerate them. */
    readonly refusals: string
}

/** The signature of a tool whose every business refusal is one of `R`: a node comparing `answer.refusal` to another code does not compile. */
export interface Refusing<R extends string> extends ToolSignature {
    /** The closed set of business refusals the tool answers. */
    readonly refusals: R
}

/**
 * The signature of a tool that can ASK a person before it runs: every tool that MUTATES (a write on a provider account or of NIVO's own
 * records), which a step of mode `ask` interrupts for approval (`nivo-frame.rights`). A person who declines the approval answers the
 * engine's `declined`, so `ToolRefusal` adds it for such a tool and for no read (a read never asks). Marked here exactly when the
 * engine's registry flags the tool as mutating (not a read): the engine's registry does not compile otherwise.
 */
export interface Asking extends ToolSignature {
    /** Marks the tool as one a step of mode `ask` interrupts for a person's approval. */
    readonly asks: true
}

/** The signature of a tool that can ask (`Asking`) and whose every business refusal is one of `R` (`Refusing`). */
export interface AskingRefusing<R extends string> extends Asking {
    /** The closed set of business refusals the tool answers. */
    readonly refusals: R
}

/** What a trigger takes (its configuration) and supplies to the graph's run (ids and counts only). */
export interface TriggerSignature {
    /** The configuration the trigger takes. */
    readonly args: JsonObject
    /** What the trigger supplies to the graph's run: ids and counts only. */
    readonly supplies: JsonObject
}

/**
 * Every tool id of NIVO → its signature. Open: the core ids are declared here, a source's ids (the CRM) by its generated names file
 * (`declare module "@nivo-lite/agent-sdk/names" { interface ToolNames { … } }`). A string that is not a key here is no tool.
 */
export interface ToolNames {
    /** Says something to a person (a contact) in their conversation: the ONE customer send; the conversation picks the channel and account. */
    "nivo.tool.customer.message.send": AskingRefusing<CustomerMessageSendRefusal>
    /** The care state of the customer the run serves: opt-out and occasions. A context read. */
    "nivo.tool.lead.care.get": ToolSignature
    /** The latest orders of the customer the run serves, newest first. A context read locked to the run's customer. */
    "nivo.tool.lead.order.list": ToolSignature
    /**
     * The contact (the person) the run serves: name, identities (masked for a customer-facing run), tags and what the workflows remember
     * of them; an internal run may name another contact of the workspace by id. A context read.
     */
    "nivo.tool.contact.get": ToolSignature
    /** Looks a person up among the contacts of the workspace: by an exact identifier (phone, mail, channel id) or a name prefix. An internal read. */
    "nivo.tool.contact.search": ToolSignature
    /** Changes the display name or the tags of the contact the run serves. */
    "nivo.tool.contact.update": AskingRefusing<ContactWriteRefusal>
    /** Remembers one fact about the contact the run serves, with where it was learned. */
    "nivo.tool.contact.memory.remember": AskingRefusing<ContactWriteRefusal>
    /**
     * Adds an identity to a contact: one an outside system or a one-time link token proves is verified; a phone or mail address the
     * person only SAID is kept as a proposal until it is verified, never merged on the claim.
     */
    "nivo.tool.contact.identity.link": AskingRefusing<ContactIdentityLinkRefusal>
    /** Merges two contacts of the workspace into one (the survivor keeps every identity and the memory). */
    "nivo.tool.contact.merge": AskingRefusing<ContactMergeRefusal>
    /** One order with its lines and its payment state. A read. */
    "nivo.tool.order.get": ToolSignature
    /** The orders awaiting payment. A read. */
    "nivo.tool.order.open.list": ToolSignature
    /**
     * NIVO's own inbox of received credits, fed by any bank feed; per credit, `namedOrder` (the order its transfer content names) and
     * `amountMatches`: the exact comparisons are the tool's, not the node's.
     */
    "nivo.tool.payment.credit.list": ToolSignature
    /**
     * One bank move of an attached bank account by its id (the bank trigger's `transactionId`), in the neutral shape every bank feed
     * answers: `{ id, direction: "in" | "out", amountVnd, content, at, account?, bankRef? }`. A read; `not_found` for an id the chosen
     * account does not hold.
     */
    "nivo.tool.payment.credit.get": ToolSignature
    /** NIVO's own record of the money that went out, fed by any bank feed. */
    "nivo.tool.payment.debit.list": ToolSignature
    /** The payment claims of a lead. A read. */
    "nivo.tool.payment.claim.list": ToolSignature
    /**
     * The bank-transfer instruction (QR and account details) for an amount and a content, into the workspace's receiving account. It
     * composes the instruction only: it moves no money, records no order and settles nothing. Served by provider `sepay`.
     */
    "nivo.tool.payment.transfer.create": ToolSignature
    /**
     * A hosted payment LINK at the payment provider under the provider's own integer order code (served by provider `payos`): `{ amountVnd,
     * description, returnUrl, cancelUrl, reference?, expiresAt? }` -> `{ linkId, orderCode, checkoutUrl, qrPayload?, amountVnd, description,
     * status, expiresAt?, reference? }`. Its OWN purpose, never merged into `paymentTransferCreate` (a bank-transfer instruction composes
     * a QR and creates nothing; a link is created at the provider, so the two are not substitutable). It creates, so it can ask first.
     */
    "nivo.tool.payment.link.create": Asking
    /** One payment link by its id or its order code: its status word and amounts. A read. */
    "nivo.tool.payment.link.get": ToolSignature
    /** Cancels one payment link by its id or its order code. Writes at the provider, so it can ask first. */
    "nivo.tool.payment.link.cancel": Asking
    /**
     * Arms a timer: later (after the run ended) the engine fires `TRIGGER.timerDue` for the same agent and subject with the caller's `ref`
     * and `data`. Arming the same `ref` again for the same agent and subject replaces the due instant.
     */
    "nivo.tool.timer.arm": Asking
    /** Cancels an armed timer by its `ref`; answers whether one was armed. */
    "nivo.tool.timer.cancel": Asking
    /** Says something to the team in the chat. */
    "nivo.tool.team.message.post": Asking
    /** Hands a conversation or a record to another agent. */
    "nivo.tool.agent.tag": AskingRefusing<PinRefusal>
    /** Adds one entry to the business ledger. */
    "nivo.tool.ledger.entry.append": Asking
    /** Takes a ledger entry back. */
    "nivo.tool.ledger.entry.void": Asking
    /** Whether a ledger is connected. */
    "nivo.tool.ledger.status.get": ToolSignature
    /** The bank's own list of movements. */
    "nivo.tool.bank.transaction.list": ToolSignature
    /** Whether the caller's accounts of a provider (or one named account) are connected and healthy. */
    "nivo.tool.connection.status.get": ToolSignature
    /** Whether the shop's drive is connected and which documents it serves: its own purpose, not the common status shape. */
    "nivo.tool.drive.status.get": ToolSignature
    /** The documents of a connected drive the shop chose as sources. */
    "nivo.tool.drive.source.list": ToolSignature
    /** Issues an e-invoice: a platform purpose (class money). */
    "nivo.tool.invoice.create": Asking
    /** The e-invoices issued, a bounded page. A read. */
    "nivo.tool.einvoice.list": ToolSignature
    /** One issued e-invoice. A read. */
    "nivo.tool.einvoice.get": ToolSignature
    /** Searches the truths in force of the business for a question, through the caller's lens. Documents: `brainPassageSearch`. */
    "nivo.tool.brain.search": ToolSignature
    /** One truth in force of the truth graph with its evidence, validity and version. */
    "nivo.tool.brain.fact.get": ToolSignature
    /** The truths in force of the truth graph, a bounded page. */
    "nivo.tool.brain.fact.list": ToolSignature
    /** The truths in force the truth graph links to one truth, with the relation. */
    "nivo.tool.brain.fact.related": ToolSignature
    /** Finds passages of the business documents the caller may read, by words or meaning; snippets only. */
    "nivo.tool.brain.passage.search": ToolSignature
    /** Reads a passage of a business document with its neighbours, or a stretch of a document from a position. */
    "nivo.tool.brain.passage.read": ToolSignature
    /** Reads one business document. */
    "nivo.tool.brain.document.read": ToolSignature
    /** Files a change to a truth said in a private or the common chat, for the founder; never puts anything in force. */
    "nivo.tool.brain.change.propose": Asking
    /**
     * The thread of the conversation the run serves, newest lines first. It takes no conversation id: the door fills the run's own and
     * refuses any other.
     */
    "nivo.tool.conversation.message.list": ToolSignature
    /**
     * What a channel says of one person on a channel account (display name and picture link, each empty when the channel gives none):
     * the profile read of the account's provider, asked through the registry. It names the account and the person's id on the channel.
     */
    "nivo.tool.customer.profile.get": ToolSignature
    /**
     * The new mails of the mailboxes the agent is attached to (ability `mail.read` of `imap`), oldest first, a bounded page with no text;
     * each mail is handed to an agent once. Read-only: the mailbox is never marked, moved or deleted.
     */
    "nivo.tool.mail.message.list": ToolSignature
    /** One mail of an attached mailbox with its plain text, bounded; lines that address an AI come marked as quotes. */
    "nivo.tool.mail.message.get": ToolSignature
    /** Sends a mail through provider `smtp`: it SENDS; whether a person is asked first is the calling node's mode (`auto` sends, `ask` interrupts before). */
    "nivo.tool.mail.message.send": Asking
    /** Posts a report card to the team chat. */
    "nivo.tool.team-chat.report.post": Asking
    /** Whether a domain name can be registered now, with its prices per period when the registrar states them. A read. */
    "nivo.tool.domain.availability.get": ToolSignature
    /** One domain the workspace holds: its status, expiry, nameservers and automatic renewal. A read. */
    "nivo.tool.domain.get": ToolSignature
    /** A page of the domains one registrar account holds. A read. */
    "nivo.tool.domain.list": ToolSignature
    /** Registers a new domain name for some years; the registrar charges the account. */
    "nivo.tool.domain.registration.create": Asking
    /** Renews a domain the workspace holds for some years, at the account that holds it. */
    "nivo.tool.domain.renewal.create": Asking
    /** Asks a domain held at another registrar to be transferred in, with the transfer code that registrar issued. */
    "nivo.tool.domain.transfer.create": Asking
    /** The DNS records of a domain the workspace holds. A read. */
    "nivo.tool.domain.dns.record.list": ToolSignature
    /** Adds one DNS record to a domain the workspace holds. */
    "nivo.tool.domain.dns.record.create": Asking
    /** Replaces one DNS record of a domain the workspace holds, by the id the record list answered. */
    "nivo.tool.domain.dns.record.update": Asking
    /** Removes one DNS record of a domain the workspace holds, by the id the record list answered. */
    "nivo.tool.domain.dns.record.delete": Asking
    /** Replaces the nameservers of a domain the workspace holds. */
    "nivo.tool.domain.nameserver.update": Asking
    /** Turns a text into an audio clip with a voice of the connected speech account; answers a file reference. */
    "nivo.tool.speech.generate": Asking
    /** The voices of the connected speech account, a page. A read. */
    "nivo.tool.speech.voice.list": ToolSignature
    /** Starts dubbing a video or audio (by its https address) into another language; answers the job id. */
    "nivo.tool.dubbing.create": Asking
    /** The state of a dubbing job and, once it is done, its files. A read. */
    "nivo.tool.dubbing.get": ToolSignature
    /** Starts generating a video from a prompt (and an optional first image); answers the job id. */
    "nivo.tool.video.generate": Asking
    /** The state of a video generation and, once it is done, its files. A read. */
    "nivo.tool.video.generation.get": ToolSignature
    /** Starts composing one video in the connected compose service from NIVO's neutral spec (signed https file addresses); answers `{ renderId, provider }` at once. */
    "nivo.tool.video.compose": AskingRefusing<VideoComposeRefusal>
    /** Where a composed render stands and, once done, the https address of the video. A read. */
    "nivo.tool.video.render.get": Refusing<VideoRenderGetRefusal>
    /**
     * One record of a record type a package declares, by id: its declared fields, version and times. A read. The engine stamps the
     * calling agent and the tool reaches only that agent's records.
     */
    "nivo.tool.record.get": Refusing<RecordGetRefusal>
    /** One page of the calling agent's records of a record type a package declares, filtered and ordered on its indexed fields. A read. */
    "nivo.tool.record.list": Refusing<RecordListRefusal>
    /** Creates one record of a record type a package declares; the type's own declaration checks every value. */
    "nivo.tool.record.create": AskingRefusing<RecordCreateRefusal>
    /** Changes declared fields of one of the calling agent's records. */
    "nivo.tool.record.update": AskingRefusing<RecordUpdateRefusal>
    /**
     * Stores a file in a declared `file` field of one of the calling agent's records and writes the reference to the record: either
     * `staged` (a file a provider tool staged, its `staged` answer) or `url` (the public https address a provider tool answered, fetched
     * once server-side within the field's limits). The file the field held is removed. Answers the reference (`FileRef`).
     */
    "nivo.tool.file.put": AskingRefusing<FilePutRefusal>
    /**
     * Attaches a file already in the store (a file uploaded to this very field of this record, or a staged file of the workspace) to a
     * declared `file` field of one of the calling agent's records. The file the field held is removed. Answers the reference.
     */
    "nivo.tool.file.link": AskingRefusing<FileLinkRefusal>
    /** A short-lived signed address to read or send the file one of the calling agent's records holds in a declared `file` field. A read. */
    "nivo.tool.file.get": Refusing<FileGetRefusal>
    /** The free slots of a calendar inside a window, computed from its busy time. A read; served by the calendar providers (`google`). */
    "nivo.tool.calendar.slot.free.list": Refusing<PublishRefusal>
    /** Makes an event on a calendar (the caller's own event id makes a repeat harmless); answers the event id and link. */
    "nivo.tool.calendar.event.create": AskingRefusing<PublishRefusal>
    /** Changes an event of a calendar: only what is given changes. */
    "nivo.tool.calendar.event.update": AskingRefusing<PublishRefusal>
    /** Cancels an event of a calendar; answers whether it was removed now or was already gone. */
    "nivo.tool.calendar.event.cancel": AskingRefusing<PublishRefusal>
    /** Publishes a post to a Facebook Page. Served by provider `meta`. */
    "nivo.tool.facebook.post.publish": AskingRefusing<PublishRefusal>
    /** Publishes a photo, video, reel, story or carousel to Instagram; answers the container to poll. Served by provider `meta`. */
    "nivo.tool.instagram.media.publish": AskingRefusing<PublishRefusal>
    /** Where an Instagram container stands. A read. Served by provider `meta`. */
    "nivo.tool.instagram.media.status.get": Refusing<PublishRefusal>
    /** Uploads a video to the connected YouTube channel. Served by provider `google`. */
    "nivo.tool.youtube.video.publish": AskingRefusing<PublishRefusal>
    /** Where a YouTube video stands. A read. Served by provider `google`. */
    "nivo.tool.youtube.video.status.get": Refusing<PublishRefusal>
    /** Posts a video to the connected TikTok account from an https address; answers the publish id to poll. Served by provider `tiktok`. */
    "nivo.tool.tiktok.video.publish": AskingRefusing<PublishRefusal>
    /** Where a TikTok post stands. A read. Served by provider `tiktok`. */
    "nivo.tool.tiktok.video.status.get": Refusing<PublishRefusal>
    /** What the connected TikTok account may post with: privacy options, interaction limits, longest video. A read. */
    "nivo.tool.tiktok.creator.info.get": Refusing<PublishRefusal>
}

/** Every trigger verb of NIVO → its signature. Open as `ToolNames`. */
export interface TriggerNames {
    /** A customer said something in a Zalo OA conversation (provider `zalo_oa`). */
    "nivo.trigger.zalo.message.received": TriggerSignature
    /** A customer said something in a Telegram conversation (provider `telegram`). */
    "nivo.trigger.telegram.message.received": TriggerSignature
    /** A customer said something in a Facebook Page conversation (provider `meta`). */
    "nivo.trigger.facebook.message.received": TriggerSignature
    /** A customer said something in an Instagram conversation (provider `meta`). */
    "nivo.trigger.instagram.message.received": TriggerSignature
    /** A visitor sent the website form (the engine's road: no provider). */
    "nivo.trigger.website.message.received": TriggerSignature
    /** A bank credit arrived (providers `sepay`, `casso`). */
    "nivo.trigger.payment.credit.received": TriggerSignature
    /** A mail arrived in an attached mailbox (provider `imap`). */
    "nivo.trigger.mail.message.received": TriggerSignature
    /**
     * A render a compose provider was asked for finished, done or failed (providers `shotstack`, `creatomate`, `json2video`). Supplies
     * `renderRowId`, `renderId` and `status`, and, filled from the stored render row, `outputUrl`, `error` and `provider`; the run that
     * started the render waits for it with a `wait` matching its own `renderId`.
     */
    "nivo.trigger.video.render.completed": TriggerSignature
    /** A moment of the clock came (args `{ preset, at? }`). */
    "nivo.trigger.clock.tick": TriggerSignature
    /**
     * A timer a run armed came due. Supplies `careKind`, `ref`, `dueAt`, the `item` it is for (the occasion's id) and the `data` it
     * carries back (`data.shipWaits`) when the arm gave them, and `suffix` (the item, for the graphs of before). A timer armed with the
     * generic `nivo.tool.timer.arm` supplies `ref` (the caller's key), `data` (what it armed), `dueAt` and its subject (`contactId`, else
     * `conversationId`): a graph registers `where: { ref }` to take exactly its own.
     */
    "nivo.trigger.timer.due": TriggerSignature
    /** A member said something in a team chat group. */
    "nivo.trigger.chat.message.received": TriggerSignature
    /** Another workflow called this one. */
    "nivo.trigger.workflow.called": TriggerSignature
}

/** What an API read takes (the payload a screen sends) and answers (the door's JSON). Every read is this until the door types each. */
export interface ApiSignature {
    /** The payload a screen sends. */
    readonly input: JsonObject
    /** The door's JSON answer. */
    readonly answer: JsonObject
}

/**
 * Every API read of NIVO (level 1: a person's screen) → its signature. Open as `ToolNames`: the core reads are declared here (`API`), a
 * source's reads (`nivo.api.crm.<method>.<path>`) by its generated names file (`interface ApiNames { … }`). A string that is not a key
 * here is no API read.
 */
export interface ApiNames {
    /** The trigger switches and deciders of the zalo-oa account. A read. */
    "nivo.api.zalo-oa.config": ApiSignature
    /** Who holds what on the zalo-oa account. A read. */
    "nivo.api.zalo-oa.rights": ApiSignature
    /** The trigger switches and deciders of the telegram account. A read. */
    "nivo.api.telegram.config": ApiSignature
    /** Who holds what on the telegram account. A read. */
    "nivo.api.telegram.rights": ApiSignature
    /** The trigger switches and deciders of the meta account. A read. */
    "nivo.api.meta.config": ApiSignature
    /** Who holds what on the meta account. A read. */
    "nivo.api.meta.rights": ApiSignature
    /** The bank feed's figures: today's credits and their sum, the last credit, the unmatched credits. A read. */
    "nivo.api.sepay.info": ApiSignature
    /** The trigger switches and deciders of the sepay account. A read. */
    "nivo.api.sepay.config": ApiSignature
    /** Who holds what on the sepay account. A read. */
    "nivo.api.sepay.rights": ApiSignature
    /** The trigger switches and deciders of the casso account. A read. */
    "nivo.api.casso.config": ApiSignature
    /** Who holds what on the casso account. A read. */
    "nivo.api.casso.rights": ApiSignature
    /** The trigger switches and deciders of the payos account. A read. */
    "nivo.api.payos.config": ApiSignature
    /** Who holds what on the payos account. A read. */
    "nivo.api.payos.rights": ApiSignature
    /** The trigger switches and deciders of the smtp account. A read. */
    "nivo.api.smtp.config": ApiSignature
    /** Who holds what on the smtp account. A read. */
    "nivo.api.smtp.rights": ApiSignature
    /** The mailbox account's current state: its address, connection and the last mail seen. A read. */
    "nivo.api.imap.info": ApiSignature
    /** The trigger switches and deciders of the imap account. A read. */
    "nivo.api.imap.config": ApiSignature
    /** Who holds what on the imap account. A read. */
    "nivo.api.imap.rights": ApiSignature
    /** The trigger switches and deciders of the google account. A read. */
    "nivo.api.google.config": ApiSignature
    /** Who holds what on the google account. A read. */
    "nivo.api.google.rights": ApiSignature
    /** The trigger switches and deciders of the inet account. A read. */
    "nivo.api.inet.config": ApiSignature
    /** Who holds what on the inet account. A read. */
    "nivo.api.inet.rights": ApiSignature
    /** The trigger switches and deciders of the tino account. A read. */
    "nivo.api.tino.config": ApiSignature
    /** Who holds what on the tino account. A read. */
    "nivo.api.tino.rights": ApiSignature
    /** The trigger switches and deciders of the elevenlabs account. A read. */
    "nivo.api.elevenlabs.config": ApiSignature
    /** Who holds what on the elevenlabs account. A read. */
    "nivo.api.elevenlabs.rights": ApiSignature
    /** The trigger switches and deciders of the veo account. A read. */
    "nivo.api.veo.config": ApiSignature
    /** Who holds what on the veo account. A read. */
    "nivo.api.veo.rights": ApiSignature
    /** The trigger switches and deciders of the tiktok account. A read. */
    "nivo.api.tiktok.config": ApiSignature
    /** Who holds what on the tiktok account. A read. */
    "nivo.api.tiktok.rights": ApiSignature
    /** The trigger switches and deciders of the shotstack account. A read. */
    "nivo.api.shotstack.config": ApiSignature
    /** Who holds what on the shotstack account. A read. */
    "nivo.api.shotstack.rights": ApiSignature
    /** The trigger switches and deciders of the creatomate account. A read. */
    "nivo.api.creatomate.config": ApiSignature
    /** Who holds what on the creatomate account. A read. */
    "nivo.api.creatomate.rights": ApiSignature
    /** The trigger switches and deciders of the json2video account. A read. */
    "nivo.api.json2video.config": ApiSignature
    /** Who holds what on the json2video account. A read. */
    "nivo.api.json2video.rights": ApiSignature
    /** The trigger switches and deciders of the misa-amis account. A read. */
    "nivo.api.misa-amis.config": ApiSignature
    /** Who holds what on the misa-amis account. A read. */
    "nivo.api.misa-amis.rights": ApiSignature
    /** The trigger switches and deciders of the misa-meinvoice account. A read. */
    "nivo.api.misa-meinvoice.config": ApiSignature
    /** Who holds what on the misa-meinvoice account. A read. */
    "nivo.api.misa-meinvoice.rights": ApiSignature
    /** The API account's current state: its pinned sources and their operations. A read. */
    "nivo.api.openapi.info": ApiSignature
    /** The trigger switches and deciders of the openapi account. A read. */
    "nivo.api.openapi.config": ApiSignature
    /** Who holds what on the openapi account. A read. */
    "nivo.api.openapi.rights": ApiSignature
    /** Starts a file upload: answers where to send the bytes. Writes a pending file row. */
    "nivo.api.nivo.file.upload": ApiSignature
    /** Confirms an uploaded file once its bytes arrived, making it readable. */
    "nivo.api.nivo.file.confirm": ApiSignature
    /** Links a stored file to a record or a contact so it is found from there. */
    "nivo.api.nivo.file.link": ApiSignature
    /** A time-limited address of one stored file. A read. */
    "nivo.api.nivo.file.get": ApiSignature
    /** Deletes one stored file and its links. */
    "nivo.api.nivo.file.delete": ApiSignature
    /** The contacts of the workspace, filtered and paged. A read. */
    "nivo.api.nivo.contact.list": ApiSignature
    /** One contact with its identities, tags and memory. A read. */
    "nivo.api.nivo.contact.get": ApiSignature
    /** The blocks of the contact page: the lists a person sees about one contact. A read. */
    "nivo.api.nivo.contact.block.list": ApiSignature
    /** Changes the display name or the tags of one contact. */
    "nivo.api.nivo.contact.update": ApiSignature
    /** Adds an identity (phone, mail, channel id) to a contact. */
    "nivo.api.nivo.contact.identity.link": ApiSignature
    /** Removes one identity from a contact. */
    "nivo.api.nivo.contact.identity.unlink": ApiSignature
    /** Merges two contacts into one; the survivor keeps every identity and the memory. */
    "nivo.api.nivo.contact.merge": ApiSignature
    /** Forgets one fact remembered about a contact. */
    "nivo.api.nivo.contact.memory.forget": ApiSignature
    /** Deletes one contact of the workspace. */
    "nivo.api.nivo.contact.delete": ApiSignature
    /** The conversation on one route, both directions (what the person said, what was said to them), newest first, paged. A read. */
    "nivo.api.nivo.customer.message.list": ApiSignature
    /** The threads of the team chat the member may see. A read. */
    "nivo.api.nivo.chat.thread.list": ApiSignature
    /** One chat thread with its messages. A read. */
    "nivo.api.nivo.chat.thread.get": ApiSignature
    /** Searches the workspace's second brain (truths, passages, documents). A read. */
    "nivo.api.nivo.brain.search": ApiSignature
    /** Reads one view of an agent's workbench. A read. */
    "nivo.api.nivo.workbench.read": ApiSignature
    /** Runs one action of an agent's workbench, as the workbench declares it. */
    "nivo.api.nivo.workbench.action": ApiSignature
    /** The record types of the installed agents with the reads and actions that reach them. A read. */
    "nivo.api.nivo.record.type.list": ApiSignature
    /** The kinds of raw data a connected account holds. A read. */
    "nivo.api.nivo.accountdata.type.list": ApiSignature
    /** The raw rows of one kind of a connected account's data. A read. */
    "nivo.api.nivo.accountdata.row.list": ApiSignature
    /** The agents of the workspace. A read. */
    "nivo.api.nivo.agent.list": ApiSignature
    /** The tools one agent may call. A read. */
    "nivo.api.nivo.agent.tool.list": ApiSignature
    /** What deleting one agent would remove or stop. A read. */
    "nivo.api.nivo.agent.deletion.impact": ApiSignature
    /** The workflows of the workspace. A read. */
    "nivo.api.nivo.workflow.list": ApiSignature
    /** One workflow with its graph. A read. */
    "nivo.api.nivo.workflow.get": ApiSignature
    /** Starts one run of a workflow by hand. */
    "nivo.api.nivo.workflow.run": ApiSignature
    /** The runs of the workspace, newest first. A read. */
    "nivo.api.nivo.run.list": ApiSignature
    /** One run with its steps and events. A read. */
    "nivo.api.nivo.run.get": ApiSignature
    /** A person's decision (approve or decline) on a step of a run that asks first. */
    "nivo.api.nivo.run.step.decide": ApiSignature
    /** The stops (questions and approvals) waiting for a person. A read. */
    "nivo.api.nivo.stop.list": ApiSignature
    /** A person's answer to one stop. */
    "nivo.api.nivo.stop.answer": ApiSignature
    /** The API keys of the workspace, without their secrets. A read. */
    "nivo.api.nivo.key.list": ApiSignature
    /** Creates an API key; the secret is shown once. Never offered by the outbound MCP surface. */
    "nivo.api.nivo.key.create": ApiSignature
    /** Renames an API key. */
    "nivo.api.nivo.key.rename": ApiSignature
    /** Revokes an API key. Never offered by the outbound MCP surface. */
    "nivo.api.nivo.key.revoke": ApiSignature
    /** Changes the role of a member. Never offered by the outbound MCP surface. */
    "nivo.api.nivo.member.role.change": ApiSignature
    /** Removes a member from the workspace. Never offered by the outbound MCP surface. */
    "nivo.api.nivo.member.remove": ApiSignature
    /** Deletes the workspace. Never offered by the outbound MCP surface. */
    "nivo.api.nivo.workspace.delete": ApiSignature
    /** The workspace's brand theme (accent, base, font, corners); null while it wears the NIVO default. A read. */
    "nivo.api.nivo.theme.get": ApiSignature
    /** Saves the workspace's brand theme, each parameter checked by range or list. Owner and manager. */
    "nivo.api.nivo.theme.update": ApiSignature
    /** Returns the workspace to the NIVO default theme. Owner and manager. */
    "nivo.api.nivo.theme.reset": ApiSignature
    /** Saves the secret of a connection (the Zalo OA's). Never offered by the outbound MCP surface. */
    "nivo.api.nivo.connection.secret.save": ApiSignature
    /** Sets a workspace's plan: a platform administrator's operation. Never offered by the outbound MCP surface. */
    "nivo.api.nivo.admin.plan.set": ApiSignature
}

/** Every provider key NIVO knows → true. Open: a CRM's key (`crm.<crmId>`) is added by its package's generated names file, never here. */
export interface ProviderNames {
    /** NIVO itself: its own tools need no connected account. */
    nivo: true
    /** Zalo Official Account: customer messages on Zalo. */
    zalo_oa: true
    /** Telegram bot: customer and team messages on Telegram. */
    telegram: true
    /** Meta: Facebook Page and Instagram messages and posts. */
    meta: true
    /** SePay: a bank feed of credits and a bank-transfer instruction. */
    sepay: true
    /** Casso: a bank feed of credits. */
    casso: true
    /** payOS: hosted payment links. */
    payos: true
    /** An SMTP server: sends mail. */
    smtp: true
    /** An IMAP mailbox: reads mail. */
    imap: true
    /** A Google account: its calendar. */
    google: true
    /** A Google Drive account: the files it shares as sources. */
    google_drive: true
    /** iNET: a domain registrar. */
    inet: true
    /** Tino: a domain registrar. */
    tino: true
    /** ElevenLabs: speech and dubbing. */
    elevenlabs: true
    /** Google Veo: video generation. */
    veo: true
    /** TikTok: direct post of a short video. */
    tiktok: true
    /** Shotstack: cloud video compose. */
    shotstack: true
    /** Creatomate: cloud video compose. */
    creatomate: true
    /** JSON2Video: cloud video compose. */
    json2video: true
    /** MISA AMIS: an accounting system. */
    misa_amis: true
    /** MISA meInvoice: an e-invoice service. */
    misa_meinvoice: true
}

/**
 * The id of one tool a node may call, declared in `ToolNames`: `nivo.tool.<1–4 segments>`, or a CRM operation
 * (`nivo.api.crm.<crmId>.<method>.<path>`) a package's generated names file declares.
 */
export type ToolId = keyof ToolNames & (`nivo.tool.${string}` | `nivo.api.crm.${string}`)

/** The verb of one trigger at the head of a graph: `nivo.trigger.<1–4 segments>`, declared in `TriggerNames`. */
export type TriggerVerb = keyof TriggerNames & `nivo.trigger.${string}`

/** The key of one provider (an account kind a workspace connects). */
export type ProviderKey = keyof ProviderNames & string

/**
 * The verb of one workbench or provider-page read: `nivo.api.<provider>.<operation>`, declared in `ApiNames`. Never in a node's reach: no
 * node member accepts this type.
 */
export type ApiVerb = keyof ApiNames & `nivo.api.${string}`

export { CRM_METHODS, crmBasePathOf, crmMapNameOf, crmNamesTextOf, crmOpNameOf, crmOpsOf } from "./crm-codegen"
export type { CrmOpEntry, CrmOpsReading } from "./crm-codegen"
export { DEFAULT_AI_READ_TOOLS, DEFAULT_NODE_TOOLS, TOOL } from "./tool"
export type {
    ContactIdentityLinkRefusal,
    ContactMergeRefusal,
    ContactWriteRefusal,
    CoreToolConstant,
    CustomerMessageSendRefusal,
    PinRefusal,
    PublishRefusal,
    FileGetRefusal,
    FileLinkRefusal,
    FilePutRefusal,
    RecordCreateRefusal,
    RecordGetRefusal,
    RecordListRefusal,
    RecordTypeRefusal,
    RecordUpdateRefusal,
    VideoComposeRefusal,
    VideoRenderGetRefusal,
} from "./tool"
export { TRIGGER } from "./trigger"
export type { CoreTriggerConstant } from "./trigger"
export { PROVIDER, providerKeySchema } from "./provider"
export type { ProviderConstants } from "./provider"
export {
    CRM_OP_PREFIX,
    CRM_PROVIDER_PREFIX,
    crmIdOfOp,
    crmIdOfProviderKey,
    crmOpPrefixOf,
    crmProviderKeyOf,
    isCrmId,
} from "./crm"
export { API, API_CARRIER, NIVO_API, PROVIDER_API, apiSegmentOf, composeApi } from "./api"
export type { ApiSource, ApiSources, CoreApiProvider, CoreApiVerb, NivoApiVerb } from "./api"
export type { CoreProviderConstant } from "./provider"
export { NIVO_API_GRAPHQL } from "./nivo-api-graphql"
export type { GraphqlOperation, NivoApiGraphql } from "./nivo-api-graphql"
export { BRAIN_FACT_FIELDS_POINTER, BRAIN_FACT_LEGEND, BRAIN_FACT_MODEL_NOTES } from "./brain-fact-legend"
export { ENGINE_TOOL_LABELS } from "./tool-labels"
export type { ToolLabelWords } from "./tool-labels"
