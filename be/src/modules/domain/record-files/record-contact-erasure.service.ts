import { Injectable } from "@nestjs/common"
import type { ContactRecordRef, ContactRecordsErasure, ContactRecordsPort } from "@modules/domain/contacts"
import { EntityMutationService } from "@modules/domain/entity-engine"
import type { StorageFilesPort } from "@modules/integrations/object-storage"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { eachInOrder } from "@modules/platform/primitives"
import { InjectRecordFilesStorage } from "./record-files.decorators"
import { RecordFilesLogEvent } from "./record-files.log-events"

@Injectable()
/**
 * The records of a contact as the contacts see them (`CONTACT_RECORDS`): the records store's erase of every record that points at the
 * contact (`EntityMutationService.eraseForContacts`, one transaction across every agent), then the removal of the files it
 * hands back. A record is only SOFT-deleted (records.md: nothing is hard-deleted), so the erase hands back none and every object stays with
 * its record; a store that cannot remove an object leaves it and logs, as a replaced file does.
 */
export class RecordContactErasureService implements ContactRecordsPort {
    constructor(
        private readonly mutations: EntityMutationService,
        @InjectRecordFilesStorage() private readonly storage: StorageFilesPort,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** The records of the type that point at the contacts, of every agent, newest first. */
    async recordsOf(workspaceId: string, contactIds: ReadonlyArray<string>, type: string): Promise<ReadonlyArray<ContactRecordRef>> {
        return await this.mutations.recordsOfContacts(workspaceId, contactIds, type)
    }

    /** Soft-deletes (or clears) the records that point at the contacts, then removes the files the erase hands back (none for a soft delete). */
    async erase(workspaceId: string, contactIds: ReadonlyArray<string>): Promise<ContactRecordsErasure> {
        const erased = await this.mutations.eraseForContacts(workspaceId, contactIds)
        if (erased.kind === "blocked") return erased
        await eachInOrder(erased.files, async (key) => {
            const removed = await this.storage.remove(key)
            if (removed.kind !== "ok") this.logger.warn(RecordFilesLogEvent.ObjectKept, { code: removed.code })
        })
        return { kind: "erased", records: erased.erased, cleared: erased.cleared }
    }
}
