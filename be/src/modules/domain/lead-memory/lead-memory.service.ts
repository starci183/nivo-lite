import { Inject, Injectable, Optional } from "@nestjs/common"
import {
    CONTACT_KEY,
    CONTACTS_STORE,
    CONTACT_MEMORY_STORE,
    type ContactMemoryEntry,
    type ContactMemoryNote,
    type ContactMemoryReader,
    type ContactMemoryStore,
    type ContactMemoryTx,
    type ContactMemoryValues,
    type ContactMemoryView,
    type ContactsStore,
    type ContactWithIdentities,
} from "@modules/domain/contacts"
import { InjectClock, type Clock } from "@modules/platform/clock"
import { eachInOrder } from "@modules/platform/primitives"
import {
    maskSnapshot,
    type LeadMemoryStore,
    type MemoryReader,
    type MemorySubject,
    type MemoryWrite,
} from "@nivo-lite/agent-sdk/node"
import type { JsonValue } from "@nivo-lite/agent-sdk/schema"
import { LeadMemoryError, LeadMemoryErrorCode } from "./errors/lead-memory.error"
import type { OptionalSnapshot, OptionalStepMemory, SensitiveOf } from "./lead-memory.contracts"
import {
    CONVERSATION_KEY,
    entryKeyOf,
    expiresAtOf,
    FACTS_NODE,
    factsValuesOf,
    isJsonRecord,
    LEAD_NAMESPACE,
    contactMemorySubjectOf,
    snapshotOf,
    stepMemoryOfRow,
    stepValuesOf,
    triggerValuesOf,
    valueOfRow,
} from "./lead-memory.policy"

/** The most entries of one customer a read takes: one per node of every workflow, far fewer in practice. */
const ENTRIES_PAGE = 500

/** The most entries one sweep deletes. */
const SWEEP_PAGE = 200

/** How often the facts are written again after another writer moved them first. */
const WRITE_TRIES = 5

/** The values of an entry as they stand, to write it again under another customer or another expiry. */
const valuesOfRow = (row: ContactMemoryEntry): ContactMemoryValues => {
    const { id: _id, version: _version, updatedAt: _updatedAt, ...values } = row
    return values
}

@Injectable()
/**
 * The one memory of each customer (`LeadMemoryStore`), across every workflow and run of theirs, on the contacts' memory table
 * (`public.contact_memory`, `CONTACT_MEMORY_STORE`): one entry per (customer, workflow namespace, node) with the latest outcome of that
 * node, one trigger entry per workflow and one facts entry per customer. A step reads the raw snapshot; display reads it masked. Resume
 * asks `stepOf` before it runs a node, so a step that already has an outcome in this run is never run (nor its AI called) again.
 */
export class LeadMemoryService implements LeadMemoryStore {
    constructor(
        @Inject(CONTACT_MEMORY_STORE) private readonly store: ContactMemoryStore,
        @InjectClock() private readonly clock: Clock,
        @Optional() @Inject(CONTACTS_STORE) private readonly contacts?: ContactsStore,
    ) {}

    /** The snapshot of a person: the entries under their contact and under their conversation, and their contact. */
    async snapshot(workspaceId: string, subject: MemorySubject, reader: MemoryReader): Promise<OptionalSnapshot> {
        return this.snapshotWith(workspaceId, subject, reader, () => ({}))
    }

    /** The snapshot as `snapshot` reads it, masking for display by the sensitive members each node declared. */
    async snapshotWith(
        workspaceId: string,
        subject: MemorySubject,
        reader: MemoryReader,
        sensitiveOf: SensitiveOf,
    ): Promise<OptionalSnapshot> {
        const rows = await this.store.transaction((tx) => tx.entriesOf(workspaceId, this.keysOf(subject), ENTRIES_PAGE))
        const contact = subject.contactId === null ? null : await this.contactOf(workspaceId, subject.contactId)
        if (rows.length === 0 && contact === null) return null
        const snapshot = snapshotOf(subject, rows, contact)
        return reader === "display" ? maskSnapshot(snapshot, sensitiveOf) : snapshot
    }

    /** The outcome one node had in one run, or null: what resume and replay return instead of running it again. */
    async stepOf(workspaceId: string, subject: MemorySubject, runId: string, nodeKey: string): Promise<OptionalStepMemory> {
        const rows = await this.store.transaction((tx) => tx.entriesOfRunNode(workspaceId, runId, nodeKey, 5))
        const keys = this.keysOf(subject)
        const row = rows.find((candidate) => keys.includes(candidate.subjectKey)) ?? rows.at(0)
        return row === undefined ? null : stepMemoryOfRow(row)
    }

    /**
     * Lays facts over the person's facts entry, outside any step (what `nivo.tool.contact.memory.remember` says was learned): only lead
     * facts are kept (`LEAD_FACTS`), the newest value wins, another writer is waited out a few times.
     */
    async remember(
        workspaceId: string,
        subject: MemorySubject,
        facts: Readonly<Record<string, JsonValue>>,
    ): Promise<void> {
        if (Object.keys(facts).length === 0) return
        await this.store.transaction((tx) => this.mergeFacts(tx, workspaceId, subject, facts, WRITE_TRIES))
    }

    /** Writes one step's outcome, the run's trigger under its workflow, and the facts it proves; a repeat writes the same values again. */
    async write(workspaceId: string, write: MemoryWrite): Promise<void> {
        const now = this.clock.now()
        await this.store.transaction(async (tx) => {
            await tx.put(workspaceId, stepValuesOf(write, now))
            await tx.put(workspaceId, triggerValuesOf(write, now))
            if (Object.keys(write.facts).length > 0) await this.mergeFacts(tx, workspaceId, write.subject, write.facts, WRITE_TRIES)
        })
    }

    /** Moves the entries of a conversation to the contact it is: written again under the contact (the contact's own win), then removed. */
    async adopt(workspaceId: string, conversationId: string, contactId: string): Promise<void> {
        await this.moveEntries(workspaceId, `${CONVERSATION_KEY}${conversationId}`, contactMemorySubjectOf(contactId, conversationId))
    }

    /** What the workflows remember of a contact: the facts entry and the step outcomes, newest first (masked for display). */
    async read(workspaceId: string, contactId: string, reader: ContactMemoryReader): Promise<ContactMemoryView> {
        const subject = contactMemorySubjectOf(contactId, null)
        const snapshot = await this.snapshot(workspaceId, subject, reader)
        const row = await this.store.transaction((tx) => tx.entryOf(workspaceId, entryKeyOf(subject.key, LEAD_NAMESPACE, FACTS_NODE)))
        const value = row === null ? null : valueOfRow(row)
        const facts = isJsonRecord(value) ? value : {}
        const notes: ReadonlyArray<ContactMemoryNote> = Object.entries(snapshot?.workflows ?? {})
            .flatMap(([workflow, steps]) =>
                Object.entries(steps).map(([step, memory]) => ({ workflow, step, status: memory.status, at: memory.at, output: memory.output })),
            )
            .toSorted((left, right) => right.at.localeCompare(left.at))
        return { facts, notes }
    }

    /** Removes the named facts of a contact's facts entry; answers the names that were held. */
    async forget(workspaceId: string, contactId: string, names: ReadonlyArray<string>): Promise<ReadonlyArray<string>> {
        const subject = contactMemorySubjectOf(contactId, null)
        return this.store.transaction(async (tx) => {
            const row = await tx.entryOf(workspaceId, entryKeyOf(subject.key, LEAD_NAMESPACE, FACTS_NODE))
            if (row === null) return []
            const held = valueOfRow(row)
            const facts = isJsonRecord(held) ? held : {}
            const gone = names.filter((name) => Object.hasOwn(facts, name))
            if (gone.length === 0) return []
            const kept = Object.fromEntries(Object.entries(facts).filter(([name]) => !gone.includes(name)))
            const written = await tx.update(workspaceId, row.id, row.version, { output: { value: kept } })
            if (!written) throw new LeadMemoryError({ code: LeadMemoryErrorCode.Contended })
            return gone
        })
    }

    /** Moves every entry of a merged contact to the survivor (the survivor's own entries win). */
    async rekey(workspaceId: string, from: string, into: string): Promise<void> {
        await this.moveEntries(workspaceId, `${CONTACT_KEY}${from}`, contactMemorySubjectOf(into, null))
    }

    /** Writes the entries under one key again under another subject (the subject's own win), then removes them. */
    private async moveEntries(workspaceId: string, from: string, to: MemorySubject): Promise<void> {
        const now = this.clock.now()
        await this.store.transaction(async (tx) => {
            const moving = await tx.entriesOf(workspaceId, [from], ENTRIES_PAGE)
            await eachInOrder(moving, async (row) => {
                if (row.namespace === LEAD_NAMESPACE && row.nodeKey === FACTS_NODE) {
                    const value = valueOfRow(row)
                    if (isJsonRecord(value)) await this.mergeFacts(tx, workspaceId, to, value, WRITE_TRIES, true)
                } else {
                    const key = entryKeyOf(to.key, row.namespace, row.nodeKey)
                    const taken = await tx.entryOf(workspaceId, key)
                    if (taken === null)
                        await tx.put(workspaceId, {
                            ...valuesOfRow(row),
                            entryKey: key,
                            subjectKey: to.key,
                            contactId: to.contactId,
                            conversationId: to.conversationId ?? row.conversationId,
                            expiresAt: expiresAtOf(to, now, null).toISOString(),
                        })
                }
                await tx.remove(workspaceId, [row.id])
            })
        })
    }

    /** Marks the contact's memory closed: every entry of theirs now goes 30 days after `at`. */
    async closed(workspaceId: string, contactId: string, at: Date): Promise<void> {
        const subject = contactMemorySubjectOf(contactId, null)
        const expiresAt = expiresAtOf(subject, at, at).toISOString()
        await this.store.transaction(async (tx) => {
            const rows = await tx.entriesOf(workspaceId, [subject.key], ENTRIES_PAGE)
            await eachInOrder(rows, (row) => tx.put(workspaceId, { ...valuesOfRow(row), closedAt: at.toISOString(), expiresAt }))
        })
    }

    /** Deletes one page of the entries whose retention ran out; answers how many went. */
    async sweep(workspaceId: string, now: Date): Promise<number> {
        return this.store.transaction(async (tx) => {
            const due = await tx.dueBefore(workspaceId, now, SWEEP_PAGE)
            await tx.remove(
                workspaceId,
                due.map((row) => row.id),
            )
            return due.length
        })
    }

    /** The contact with its identities, read from the contacts store; null without one. */
    private async contactOf(workspaceId: string, contactId: string): Promise<ContactWithIdentities | null> {
        if (this.contacts === undefined) return null
        return this.contacts.transaction(async (tx) => {
            const [contact] = await tx.contactsOf(workspaceId, [contactId])
            if (contact?.state !== "active") return null
            return { ...contact, identities: await tx.identitiesOf(workspaceId, [contact.id]) }
        })
    }

    /** The keys a person's entries may sit under: their contact, then their conversation. */
    private keysOf(subject: MemorySubject): ReadonlyArray<string> {
        return [
            ...new Set([
                subject.key,
                ...(subject.contactId === null ? [] : [`${CONTACT_KEY}${subject.contactId}`]),
                ...(subject.conversationId === null ? [] : [`${CONVERSATION_KEY}${subject.conversationId}`]),
            ]),
        ]
    }

    /** Lays `facts` over the facts entry of the customer under the version read; `under` keeps what the entry holds over them. */
    private async mergeFacts(
        tx: ContactMemoryTx,
        workspaceId: string,
        subject: MemorySubject,
        facts: Readonly<Record<string, JsonValue>>,
        left: number,
        under: boolean = false,
    ): Promise<void> {
        if (left <= 0) throw new LeadMemoryError({ code: LeadMemoryErrorCode.Contended })
        const now = this.clock.now()
        const row = await tx.entryOf(workspaceId, entryKeyOf(subject.key, LEAD_NAMESPACE, FACTS_NODE))
        if (row === null) {
            await tx.put(workspaceId, factsValuesOf(subject, {}, facts, now))
            return
        }
        const held = valueOfRow(row)
        const before = isJsonRecord(held) ? held : {}
        const values = under ? factsValuesOf(subject, facts, before, now) : factsValuesOf(subject, before, facts, now)
        if (!(await tx.update(workspaceId, row.id, row.version, values)))
            await this.mergeFacts(tx, workspaceId, subject, facts, left - 1, under)
    }
}
