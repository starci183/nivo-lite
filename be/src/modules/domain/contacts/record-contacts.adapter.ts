import { Inject, Injectable } from "@nestjs/common"
import type { RecordContactsPort } from "@modules/domain/entity-engine/record-contacts.port"
import { eachInOrder } from "@modules/platform/primitives"
import { CONTACTS_STORE, type ContactsStore } from "./contacts-store.port"
import { isContactId } from "./contacts.service"

@Injectable()
/**
 * The contacts as the records store proves a contact field against them (`RECORD_CONTACTS`, the engine's port): which ids are the
 * workspace's active contacts and the id each stands for now (one redirect hop, as `ContactsService.current`), and the ids merged into a
 * contact (what a filter on a contact field matches). Reads only; the records store never reads the contacts' tables itself.
 */
export class RecordContactsAdapter implements RecordContactsPort {
    constructor(@Inject(CONTACTS_STORE) private readonly store: ContactsStore) {}

    /** Every id that names an active contact of the workspace (directly or through its merge), to the id it stands for now. */
    async currentOf(workspaceId: string, contactIds: ReadonlyArray<string>): Promise<ReadonlyMap<string, string>> {
        const ids = [...new Set(contactIds)].filter(isContactId)
        if (ids.length === 0) return new Map()
        return await this.store.transaction(async (tx) => {
            const redirects = await tx.redirectsOf(workspaceId, ids)
            const nowOf = (id: string): string => redirects.get(id) ?? id
            const held = await tx.contactsOf(workspaceId, [...new Set(ids.map((id) => nowOf(id)))])
            const active = new Set(held.filter((contact) => contact.state === "active").map((contact) => contact.id))
            return new Map(ids.flatMap((id): ReadonlyArray<readonly [string, string]> => (active.has(nowOf(id)) ? [[id, nowOf(id)]] : [])))
        })
    }

    /**
     * Each id to the contact it stands for now and every id merged into it; an id of no contact maps to itself. An id whose contact
     * (or the survivor it was merged into) is ERASED maps to NO id (R31, DEF-6): a read that goes through an erased person (a filter on a
     * contact field naming them) finds nothing, while the records keep their reference.
     */
    async aliasesOf(
        workspaceId: string,
        contactIds: ReadonlyArray<string>,
    ): Promise<ReadonlyMap<string, ReadonlyArray<string>>> {
        const ids = [...new Set(contactIds)]
        const shaped = ids.filter(isContactId)
        return await this.store.transaction(async (tx) => {
            const redirects = shaped.length === 0 ? new Map<string, string>() : await tx.redirectsOf(workspaceId, shaped)
            const nowOf = (id: string): string => redirects.get(id) ?? id
            const held = shaped.length === 0 ? [] : await tx.contactsOf(workspaceId, [...new Set(shaped.map((id) => nowOf(id)))])
            const erased = new Set(held.filter((contact) => contact.state === "erased").map((contact) => contact.id))
            const answered = new Map<string, ReadonlyArray<string>>()
            await eachInOrder(ids, async (id) => {
                const now = nowOf(id)
                if (erased.has(now)) {
                    answered.set(id, [])
                    return
                }
                const merged = isContactId(id) ? await tx.aliasesOf(workspaceId, now) : []
                answered.set(id, [...new Set([now, id, ...merged])])
            })
            return answered
        })
    }
}
