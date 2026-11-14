import { Injectable } from "@nestjs/common"
import type { ContactMemoryPort, ContactMemoryReader, ContactMemoryView } from "@modules/domain/contacts"
import type { JsonValue } from "@nivo-lite/agent-sdk/schema"
import { contactMemorySubjectOf } from "./lead-memory.policy"
import { LeadMemoryService } from "./lead-memory.service"

@Injectable()
/** The engine's memory as the contacts store moves it (`CONTACT_MEMORY`): every entry is keyed by the contact; a deletion removes none. */
export class ContactMemoryAdapter implements ContactMemoryPort {
    constructor(private readonly memory: LeadMemoryService) {}

    /** What the workflows remember of the contact, as the reader may see it. */
    read(workspaceId: string, contactId: string, reader: ContactMemoryReader): Promise<ContactMemoryView> {
        return this.memory.read(workspaceId, contactId, reader)
    }

    /** Keeps facts under the contact; a newer value of a fact wins. */
    remember(workspaceId: string, contactId: string, facts: Readonly<Record<string, JsonValue>>): Promise<void> {
        return this.memory.remember(workspaceId, contactMemorySubjectOf(contactId, null), facts)
    }

    /** Drops facts of the contact; answers the names of the facts that were held. */
    forget(workspaceId: string, contactId: string, facts: ReadonlyArray<string>): Promise<ReadonlyArray<string>> {
        return this.memory.forget(workspaceId, contactId, facts)
    }

    /** Moves what is remembered under one contact to another, when the two are merged. */
    rekey(workspaceId: string, from: string, into: string): Promise<void> {
        return this.memory.rekey(workspaceId, from, into)
    }
}
