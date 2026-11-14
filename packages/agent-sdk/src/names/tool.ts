import type { ToolId } from "./index"

/**
 * The id of every tool a node or a step's agent may call, by a stable name. Packages write `TOOL.recordCreate`, never the string, so an id
 * is renamed here and nowhere else. Every id reads `nivo.tool.<domain>.<object>.<verb>` (one to four parts after the level) and is named
 * by ONE purpose: what it does for the business and for whom, never by a channel or by how it is built. A provider (a bank feed, a sheet,
 * a CRM) is an ADAPTER behind a purpose. There is no alias of an id: an old id resolves to nothing, and no old constant name is kept.
 */
export const TOOL = {
    /** Says something to a person (a contact) in their conversation: the ONE customer send; the conversation picks the channel and account. */
    customerMessageSend: "nivo.tool.customer.message.send",
    /** The care state of the customer the run serves: opt-out and occasions. A context read. */
    leadCareGet: "nivo.tool.lead.care.get",
    /** The latest orders of the customer the run serves, newest first. A context read locked to the run's customer. */
    leadOrderList: "nivo.tool.lead.order.list",
    /**
     * The contact (the person) the run serves: name, identities (masked for a customer-facing run), tags and what the workflows remember
     * of them; an internal run may name another contact of the workspace by id. A context read.
     */
    contactGet: "nivo.tool.contact.get",
    /** Looks a person up among the contacts of the workspace: by an exact identifier (phone, mail, channel id) or a name prefix. An internal read. */
    contactSearch: "nivo.tool.contact.search",
    /** Changes the display name or the tags of the contact the run serves. */
    contactUpdate: "nivo.tool.contact.update",
    /** Remembers one fact about the contact the run serves, with where it was learned. */
    contactMemoryRemember: "nivo.tool.contact.memory.remember",
    /**
     * Adds an identity to a contact: one an outside system or a one-time link token proves is verified; a phone or mail address the
     * person only SAID is kept as a proposal until it is verified, never merged on the claim.
     */
    contactIdentityLink: "nivo.tool.contact.identity.link",
    /** Merges two contacts of the workspace into one (the survivor keeps every identity and the memory). */
    contactMerge: "nivo.tool.contact.merge",
    /** One order with its lines and its payment state. A read. */
    orderGet: "nivo.tool.order.get",
    /** The orders awaiting payment. A read. */
    orderOpenList: "nivo.tool.order.open.list",
    /**
     * NIVO's own inbox of received credits, fed by any bank feed; per credit, `namedOrder` (the order its transfer content names) and
     * `amountMatches`: the exact comparisons are the tool's, not the node's.
     */
    paymentCreditList: "nivo.tool.payment.credit.list",
    /** NIVO's own record of the money that went out, fed by any bank feed. */
    paymentDebitList: "nivo.tool.payment.debit.list",
    /**
     * One bank move of an attached bank account by its id (the bank trigger's `transactionId`), in the neutral shape every bank feed
     * answers: `{ id, direction: "in" | "out", amountVnd, content, at, account?, bankRef? }`. A read; `not_found` for an id the chosen
     * account does not hold.
     */
    paymentCreditGet: "nivo.tool.payment.credit.get",
    /** The payment claims of a lead. A read. */
    paymentClaimList: "nivo.tool.payment.claim.list",
    /**
     * The bank-transfer instruction (QR and account details) for an amount and a content, into the workspace's receiving account. It
     * composes the instruction only: it moves no money, records no order and settles nothing. Served by provider `sepay`.
     */
    paymentTransferCreate: "nivo.tool.payment.transfer.create",
    /**
     * A hosted payment LINK at the payment provider under the provider's own integer order code (served by provider `payos`): `{ amountVnd,
     * description, returnUrl, cancelUrl, reference?, expiresAt? }` -> `{ linkId, orderCode, checkoutUrl, qrPayload?, amountVnd, description,
     * status, expiresAt?, reference? }`. Its OWN purpose, never merged into `paymentTransferCreate` (a bank-transfer instruction composes
     * a QR and creates nothing; a link is created at the provider, so the two are not substitutable). It creates, so it can ask first.
     */
    paymentLinkCreate: "nivo.tool.payment.link.create",
    /** One payment link by its id or its order code: its status word and amounts. A read. */
    paymentLinkGet: "nivo.tool.payment.link.get",
    /** Cancels one payment link by its id or its order code. Writes at the provider, so it can ask first. */
    paymentLinkCancel: "nivo.tool.payment.link.cancel",
    /**
     * Arms a timer: later (after the run ended) the engine fires `TRIGGER.timerDue` for the same agent and subject with the caller's `ref`
     * and `data`. Arming the same `ref` again for the same agent and subject replaces the due instant.
     */
    timerArm: "nivo.tool.timer.arm",
    /** Cancels an armed timer by its `ref`; answers whether one was armed. */
    timerCancel: "nivo.tool.timer.cancel",
    /** Says something to the team in the chat. */
    teamMessagePost: "nivo.tool.team.message.post",
    /** Hands a conversation or a record to another agent. */
    agentTag: "nivo.tool.agent.tag",
    /** Adds one entry to the business ledger. */
    ledgerEntryAppend: "nivo.tool.ledger.entry.append",
    /** Takes a ledger entry back. */
    ledgerEntryVoid: "nivo.tool.ledger.entry.void",
    /** Whether a ledger is connected. */
    ledgerStatusGet: "nivo.tool.ledger.status.get",
    /** The bank's own list of movements. */
    bankTransactionList: "nivo.tool.bank.transaction.list",
    /** Whether the caller's accounts of a provider (or one named account) are connected and healthy. */
    connectionStatusGet: "nivo.tool.connection.status.get",
    /** Whether the shop's drive is connected and which documents it serves: its own purpose, not the common status shape. */
    driveStatusGet: "nivo.tool.drive.status.get",
    /** The documents of a connected drive the shop chose as sources. */
    driveSourceList: "nivo.tool.drive.source.list",
    /** Issues an e-invoice AT the e-invoice provider (MISA meInvoice today) on the seller account the step is bound to; NIVO keeps no invoice tool of its own (R57). */
    invoiceCreate: "nivo.tool.invoice.create",
    /** The e-invoices issued, a bounded page. A read. */
    einvoiceList: "nivo.tool.einvoice.list",
    /** One issued e-invoice. A read. */
    einvoiceGet: "nivo.tool.einvoice.get",
    /** Searches the truths in force of the business for a question, through the caller's lens. Documents: `brainPassageSearch`. */
    brainSearch: "nivo.tool.brain.search",
    /** One truth in force of the truth graph with its evidence, validity and version. */
    brainFactGet: "nivo.tool.brain.fact.get",
    /** The truths in force of the truth graph, a bounded page. */
    brainFactList: "nivo.tool.brain.fact.list",
    /** The truths in force the truth graph links to one truth, with the relation. */
    brainFactRelated: "nivo.tool.brain.fact.related",
    /** Finds passages of the business documents the caller may read, by words or meaning; snippets only. */
    brainPassageSearch: "nivo.tool.brain.passage.search",
    /** Reads a passage of a business document with its neighbours, or a stretch of a document from a position. */
    brainPassageRead: "nivo.tool.brain.passage.read",
    /** Reads one business document. */
    brainDocumentRead: "nivo.tool.brain.document.read",
    /** Files a change to a truth said in a private or the common chat, for the founder; never puts anything in force. */
    brainChangePropose: "nivo.tool.brain.change.propose",
    /**
     * The thread of the conversation the run serves, newest lines first. It takes no conversation id: the door fills the run's own and
     * refuses any other.
     */
    conversationMessageList: "nivo.tool.conversation.message.list",
    /**
     * What a channel says of one person on a channel account: the display name and the picture link, each empty when the channel gives none.
     * Provider-neutral: the engine asks the profile read the account's provider registered. A read that keeps nothing and changes no contact:
     * a node that wants the name or the picture writes it where it belongs. A node lists it to call it.
     */
    customerProfileGet: "nivo.tool.customer.profile.get",
    /**
     * The new mails of the mailboxes the agent is attached to (ability `mail.read` of `imap`), oldest first, a bounded page with no text;
     * each mail is handed to an agent once. Read-only: the mailbox is never marked, moved or deleted.
     */
    mailMessageList: "nivo.tool.mail.message.list",
    /** One mail of an attached mailbox with its plain text, bounded; lines that address an AI come marked as quotes. */
    mailMessageGet: "nivo.tool.mail.message.get",
    /** Sends a mail through provider `smtp`: it SENDS; whether a person is asked first is the calling node's mode (`auto` sends, `ask` interrupts before). */
    mailMessageSend: "nivo.tool.mail.message.send",
    /** Posts a report card to the team chat. */
    teamChatReportPost: "nivo.tool.team-chat.report.post",
    /** Whether a domain name can be registered now, with its prices per period when the registrar states them. A read. */
    domainAvailabilityGet: "nivo.tool.domain.availability.get",
    /** One domain the workspace holds: its status, expiry, nameservers and automatic renewal. A read. */
    domainGet: "nivo.tool.domain.get",
    /** A page of the domains one registrar account holds. A read. */
    domainList: "nivo.tool.domain.list",
    /** Registers a new domain name for some years; the registrar charges the account. */
    domainRegistrationCreate: "nivo.tool.domain.registration.create",
    /** Renews a domain the workspace holds (or a service on it: hosting, ssl) for some years, at the provider account that holds it. */
    domainRenewalCreate: "nivo.tool.domain.renewal.create",
    /** Whether a renewal of a held domain took effect: its expiry read now against the one before the renewal (renewed or pending). A read. */
    domainRenewalGet: "nivo.tool.domain.renewal.get",
    /** Asks a domain held at another registrar to be transferred in, with the transfer code that registrar issued. */
    domainTransferCreate: "nivo.tool.domain.transfer.create",
    /** The DNS records of a domain the workspace holds. A read. */
    domainDnsRecordList: "nivo.tool.domain.dns.record.list",
    /** Adds one DNS record to a domain the workspace holds. */
    domainDnsRecordCreate: "nivo.tool.domain.dns.record.create",
    /** Replaces one DNS record of a domain the workspace holds, by the id the record list answered. */
    domainDnsRecordUpdate: "nivo.tool.domain.dns.record.update",
    /** Removes one DNS record of a domain the workspace holds, by the id the record list answered. */
    domainDnsRecordDelete: "nivo.tool.domain.dns.record.delete",
    /** Replaces the nameservers of a domain the workspace holds. */
    domainNameserverUpdate: "nivo.tool.domain.nameserver.update",
    /** Turns a text into an audio clip with a voice of the connected speech account; answers a file reference. */
    speechGenerate: "nivo.tool.speech.generate",
    /** The voices of the connected speech account, a page. A read. */
    speechVoiceList: "nivo.tool.speech.voice.list",
    /** Starts dubbing a video or audio (by its https address) into another language; answers the job id. */
    dubbingCreate: "nivo.tool.dubbing.create",
    /** The state of a dubbing job and, once it is done, its files. A read. */
    dubbingGet: "nivo.tool.dubbing.get",
    /** Starts generating a video from a prompt (and an optional first image); answers the job id. */
    videoGenerate: "nivo.tool.video.generate",
    /** The state of a video generation and, once it is done, its files. A read. */
    videoGenerationGet: "nivo.tool.video.generation.get",
    /** Starts composing one video in the connected compose service from NIVO's neutral spec (signed https file addresses); answers `{ renderId, provider }` at once. */
    videoCompose: "nivo.tool.video.compose",
    /** Where a composed render stands and, once done, the https address of the video. A read. */
    videoRenderGet: "nivo.tool.video.render.get",
    /**
     * One record of a record type a package declares, by id: its declared fields, version and times. A read. The engine stamps the
     * calling agent and the tool reaches only that agent's records.
     */
    recordGet: "nivo.tool.record.get",
    /** One page of the calling agent's records of a record type a package declares, filtered and ordered on its indexed fields. A read. */
    recordList: "nivo.tool.record.list",
    /** Creates one record of a record type a package declares; the type's own declaration checks every value. */
    recordCreate: "nivo.tool.record.create",
    /** Changes declared fields of one of the calling agent's records. */
    recordUpdate: "nivo.tool.record.update",
    /**
     * Stores a file in a declared `file` field of one of the calling agent's records and writes the reference to the record: either
     * `staged` (a file a provider tool staged, its `staged` answer) or `url` (the public https address a provider tool answered, fetched
     * once server-side within the field's limits). The file the field held is removed. Answers the reference (`FileRef`).
     */
    filePut: "nivo.tool.file.put",
    /**
     * Attaches a file already in the store (a file uploaded to this very field of this record, or a staged file of the workspace) to a
     * declared `file` field of one of the calling agent's records. The file the field held is removed. Answers the reference.
     */
    fileLink: "nivo.tool.file.link",
    /** A short-lived signed address to read or send the file one of the calling agent's records holds in a declared `file` field. A read. */
    fileGet: "nivo.tool.file.get",
    /** The free slots of a calendar inside a window, computed from its busy time. A read; served by the calendar providers (`google`). */
    calendarSlotFreeList: "nivo.tool.calendar.slot.free.list",
    /** Makes an event on a calendar (the caller's own event id makes a repeat harmless); answers the event id and link. */
    calendarEventCreate: "nivo.tool.calendar.event.create",
    /** Changes an event of a calendar: only what is given changes. */
    calendarEventUpdate: "nivo.tool.calendar.event.update",
    /** Cancels an event of a calendar; answers whether it was removed now or was already gone. */
    calendarEventCancel: "nivo.tool.calendar.event.cancel",
    /** Publishes a post to a Facebook Page. Served by provider `meta`. */
    facebookPostPublish: "nivo.tool.facebook.post.publish",
    /** Publishes a photo, video, reel, story or carousel to Instagram; answers the container to poll. Served by provider `meta`. */
    instagramMediaPublish: "nivo.tool.instagram.media.publish",
    /** Where an Instagram container stands. A read. Served by provider `meta`. */
    instagramMediaStatusGet: "nivo.tool.instagram.media.status.get",
    /** Uploads a video to the connected YouTube channel. Served by provider `google`. */
    youtubeVideoPublish: "nivo.tool.youtube.video.publish",
    /** Where a YouTube video stands. A read. Served by provider `google`. */
    youtubeVideoStatusGet: "nivo.tool.youtube.video.status.get",
    /** Posts a video to the connected TikTok account from an https address; answers the publish id to poll. Served by provider `tiktok`. */
    tiktokVideoPublish: "nivo.tool.tiktok.video.publish",
    /** Where a TikTok post stands. A read. Served by provider `tiktok`. */
    tiktokVideoStatusGet: "nivo.tool.tiktok.video.status.get",
    /** What the connected TikTok account may post with: privacy options, interaction limits, longest video. A read. */
    tiktokCreatorInfoGet: "nivo.tool.tiktok.creator.info.get",
} as const

/**
 * The tools every node may call without listing them (the record and file tools: they reach only the calling agent's own records, so
 * they act on nobody outside). A template's `tools` never lists them; the checks of a node's calls treat them as always listed.
 */
export const DEFAULT_NODE_TOOLS: ReadonlyArray<ToolId> = [
    TOOL.recordGet,
    TOOL.recordList,
    TOOL.recordCreate,
    TOOL.recordUpdate,
    TOOL.filePut,
    TOOL.fileLink,
    TOOL.fileGet,
    // The timers act inside the engine only (a wake of the agent's own graph): no outside party is touched.
    TOOL.timerArm,
    TOOL.timerCancel,
]

/**
 * The READ-CONTEXT tools every AI step (`ctx.agent.run`) of every node holds without listing them and is always shown: the truth graph's
 * reads (search, facts, passages, documents), the thread of the run's own conversation and the run's own contact. The door locks the
 * conversation and contact reads to the run's own ids and reads the brain through the caller's lens; none of them writes. A node's own
 * code (`ctx.tools.call`) calls one only when its `tools` lists it.
 */
export const DEFAULT_AI_READ_TOOLS: ReadonlyArray<ToolId> = [
    TOOL.brainSearch,
    TOOL.brainFactGet,
    TOOL.brainFactList,
    TOOL.brainFactRelated,
    TOOL.brainPassageSearch,
    TOOL.brainPassageRead,
    TOOL.brainDocumentRead,
    TOOL.conversationMessageList,
    TOOL.contactGet,
]

/** Compiles only when every value is a declared name: a constant whose id is not a key of the names interface is a compile error. */
type Declared<T extends Readonly<Record<string, ToolId>>> = T

/** The name of one core tool constant. */
export type CoreToolConstant = keyof Declared<typeof TOOL>

/**
 * The refusals the run's pin answers on the effect road for every effect: a call outside its run's conversation or customer. They are the
 * engine's BUSINESS refusals of an effect no provider account holds and of one a provider ability holds alike. The agent's own grant row set
 * to never (`tool_off`) and the attachments' refusals (`not_attached`, `ability_off`, `no_default_account`, `notice_run`) are refusals of a
 * right or of the setup: they freeze the step (ADDENDUM 4.3), so they are no answer a node reads.
 */
export type PinRefusal = "conversation_mismatch" | "lead_mismatch" | "conversation_unverified"

/**
 * What a write to a contact answers besides its result: the contact is not one of the workspace (`contact_missing`), or a run that serves
 * one person named another (`other_contact`).
 */
export type ContactWriteRefusal = "contact_missing" | "other_contact"

/**
 * What linking an identity answers: the store's integrity only. An identifier that cannot be normalised (`identity_invalid`), a verified
 * identity another contact holds (`identity_taken`: a merge is its own act), a link token that is unknown, used or expired
 * (`token_invalid`) or an outside system's identity on an account the workspace does not hold (`account_missing`). An outside identity
 * linked from a run that serves a customer (`internal_only`) or with no person's approval (`ask_only`) freezes the step: no node reads it.
 */
export type ContactIdentityLinkRefusal =
    | ContactWriteRefusal
    | "identity_invalid"
    | "identity_taken"
    | "token_invalid"
    | "account_missing"

/**
 * What merging two contacts answers: the store's integrity (a contact the workspace does not hold, a merge with itself) and a merge no
 * person decided (`no_proof`): a proof merges by itself (an exact verified phone or mail on link, a link token), so a merge call is a
 * person's decision, its approval.
 */
export type ContactMergeRefusal = "contact_missing" | "same_contact" | "no_proof"

/** What the customer send answers: its rules, the channel's answer, and one line per stop. */
export type CustomerMessageSendRefusal =
    | PinRefusal
    | "no_recipient"
    | "no_channel_identity"
    | "channel_ambiguous"
    | "route_held"
    | "connection_missing"
    | "channel_no_access"
    | "customer_opted_out"
    | "recipient_not_linked"
    | "outside_window"
    | "plan_blocked"
    | "not_delivered"
    | "already_told_for_this_stop"

/** What every record tool may refuse of the type a call names: no package declares it. */
export type RecordTypeRefusal = "type_unknown"

/** What `nivo.tool.record.get` refuses. */
export type RecordGetRefusal = RecordTypeRefusal | "not_found"

/** What `nivo.tool.record.list` refuses: a filter, order or cursor that does not fit the type, or one no declared index serves. */
export type RecordListRefusal = RecordTypeRefusal | "query_invalid" | "query_not_indexed"

/** What `nivo.tool.record.create` refuses: values the type's declaration does not take, or a unique value another record holds. */
export type RecordCreateRefusal = RecordTypeRefusal | "invalid_value" | "taken"

/** What `nivo.tool.record.update` refuses. */
export type RecordUpdateRefusal = RecordTypeRefusal | "not_found" | "invalid_value" | "taken" | "stale"

/**
 * What a destination or calendar tool refuses as a business answer (`nivo.tool.calendar.*`, `facebook.*`, `instagram.*`, `youtube.*`,
 * `tiktok.*`): the platform refused the request and did nothing (`rejected`), or the calendar, event, post, container, video or publish
 * id is not there (`not_found`). A missing credential or consent freezes the step instead.
 */
export type PublishRefusal = "rejected" | "not_found"

/** What `nivo.tool.file.put` refuses (the business codes of `FILE_REFUSAL_CLASS`). */
export type FilePutRefusal =
    | "type_unknown"
    | "field_not_file"
    | "not_found"
    | "mime_not_accepted"
    | "too_big"
    | "key_invalid"
    | "object_missing"
    | "url_invalid"
    | "url_unreachable"
    | "quota_exceeded"
    | "record_rejected"

/** What `nivo.tool.file.link` refuses. */
export type FileLinkRefusal =
    | "type_unknown"
    | "field_not_file"
    | "not_found"
    | "mime_not_accepted"
    | "too_big"
    | "key_invalid"
    | "object_missing"
    | "quota_exceeded"
    | "record_rejected"

/** What `nivo.tool.file.get` refuses. */
export type FileGetRefusal = "type_unknown" | "field_not_file" | "not_found" | "no_file" | "key_invalid"

/** What `nivo.tool.video.compose` refuses as a business answer: the spec breaks a rule across its members, or the provider refused it (its words ride as `detail`). */
export type VideoComposeRefusal = "invalid_spec" | "provider_refused"

/** What `nivo.tool.video.render.get` refuses: the render is not at the account. */
export type VideoRenderGetRefusal = "not_found"
