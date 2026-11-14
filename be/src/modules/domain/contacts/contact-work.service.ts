import { Inject, Injectable } from "@nestjs/common"
import { iterationKeyPartsOf } from "@nivo-lite/agent-sdk/node"
import { CONTACT_WORK_STORE, type ContactWorkRow, type ContactWorkStore } from "./contact-work-store.port"
import { roundOfItemKey } from "./contact-work.policy"
import { contactKeyOf } from "./contact-subject.policy"
import { ContactsService } from "./contacts.service"

/** The most step outcomes one read answers. */
export const CONTACT_WORK_MAX = 50

/** One step an agent did for a person: the stored outcome with its node key split into the node and the round it ran in. */
export interface ContactWorkStep extends ContactWorkRow {
    /** The node key without the loop path (`talk[r2].opening` → `opening`). */
    readonly node: string
    /** The round of an until loop the step ran in, or null for a step outside one. */
    readonly round: number | null
}

@Injectable()
/**
 * What the agents did for a person (the memory's step outcomes, newest first, one per node of each workflow). The engine keeps keys; the
 * labels a page shows are put on them by the caller. A person who is deleted or unknown has none (soft delete, R31).
 */
export class ContactWorkService {
    constructor(
        @Inject(CONTACT_WORK_STORE) private readonly store: ContactWorkStore,
        private readonly contacts: ContactsService,
    ) {}

    /** The latest step outcomes of the person (a merged id is followed to its survivor), at most `limit` (never over `CONTACT_WORK_MAX`). */
    async recent(workspaceId: string, contactId: string, limit: number = CONTACT_WORK_MAX): Promise<ReadonlyArray<ContactWorkStep>> {
        const current = await this.contacts.activeId(workspaceId, contactId)
        if (current === null) return []
        const rows = await this.store.recentOf(workspaceId, contactKeyOf(current), Math.max(1, Math.min(limit, CONTACT_WORK_MAX)))
        return rows.map((row) => {
            const parts = iterationKeyPartsOf(row.nodeKey)
            return { ...row, node: parts?.nodeKey ?? row.nodeKey, round: roundOfItemKey(parts?.itemKey ?? null) }
        })
    }
}
