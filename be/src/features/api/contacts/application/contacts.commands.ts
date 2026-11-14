import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type {
    ContactView,
    DeleteContactRequest,
    ForgetContactMemoryRequest,
    LinkContactIdentityRequest,
    LinkContactIdentityView,
    MergeContactsRequest,
    UnlinkContactIdentityRequest,
    UpdateContactRequest,
} from "@modules/domain/contacts"

/** `nivo.api.nivo.contact.update`: the display name and / or the tags. */
export class UpdateContactCommand extends Command<ContactView> {
    constructor(readonly params: ExecuteParams<UpdateContactRequest>) {
        super()
    }
}

/** `nivo.api.nivo.contact.identity.link`: an identity a person links. */
export class LinkContactIdentityCommand extends Command<LinkContactIdentityView> {
    constructor(readonly params: ExecuteParams<LinkContactIdentityRequest>) {
        super()
    }
}

/** `nivo.api.nivo.contact.identity.unlink`: an identity a person takes away. */
export class UnlinkContactIdentityCommand extends Command<ContactView> {
    constructor(readonly params: ExecuteParams<UnlinkContactIdentityRequest>) {
        super()
    }
}

/** `nivo.api.nivo.contact.merge`: two contacts a person decides are one. */
export class MergeContactsCommand extends Command<ContactView> {
    constructor(readonly params: ExecuteParams<MergeContactsRequest>) {
        super()
    }
}

/** `nivo.api.nivo.contact.memory.forget`: facts the agents forget. */
export class ForgetContactMemoryCommand extends Command<ReadonlyArray<string>> {
    constructor(readonly params: ExecuteParams<ForgetContactMemoryRequest>) {
        super()
    }
}

/** `nivo.api.nivo.contact.delete`: the owner deletes a contact softly (R31). */
export class DeleteContactCommand extends Command<boolean> {
    constructor(readonly params: ExecuteParams<DeleteContactRequest>) {
        super()
    }
}
