import { DomainError } from "@starci/common"
import type { BlockFileStore, BlockFiles } from "./block.types"

/** The read slot a file block binds to the record whose file field it shows: its read grants the block's `url` calls. */
export const FILE_RECORD_SLOT = "record"

/** The action slot a file block that changes a file binds: its action grants the block's `upload` and `remove` calls. */
export const FILE_WRITE_SLOT = "write"

/** The read and action a spec bound to the file slots of one node; null for a slot the node left unbound. */
export interface FileBindings {
    /** The id of the read bound to {@link FILE_RECORD_SLOT}. */
    readonly read: string | null
    /** The id of the action bound to {@link FILE_WRITE_SLOT}. */
    readonly write: string | null
}

/** The code of the rejection a call gets when the node bound nothing that could grant it. */
export const FILE_UNBOUND = "BLOCK_FILES_UNBOUND"

/** What a file call is refused with when the node bound no read or action to grant it; `params.at` names the slot. */
export class FileBindingError extends DomainError<typeof FILE_UNBOUND> {
    constructor(slot: string) {
        super({ code: FILE_UNBOUND, params: { at: slot } })
    }
}

/**
 * The file store closed over the bindings of one node, as a block calls it: record and field only. A change (`upload`, `remove`) goes
 * through the action of the {@link FILE_WRITE_SLOT} slot; a read of the file (`url`) through the read of the {@link FILE_RECORD_SLOT}
 * slot, else through the action, so a viewer who may only look still gets the address. A call whose slot is unbound rejects with
 * {@link FILE_UNBOUND} (a spec that binds a file block's slots is refused before that: they are required).
 */
export const filesVia = (store: BlockFileStore, bindings: FileBindings): BlockFiles => ({
    upload: async (recordType, recordId, field, file, options) => {
        if (bindings.write === null) throw new FileBindingError(FILE_WRITE_SLOT)
        const stored = await store.upload(bindings.write, recordType, recordId, field, file, options)
        return stored
    },
    url: async (recordType, recordId, field, key) => {
        const via = bindings.read ?? bindings.write
        if (via === null) throw new FileBindingError(FILE_RECORD_SLOT)
        const address = await store.url(via, recordType, recordId, field, key)
        return address
    },
    remove: async (recordType, recordId, field, key) => {
        if (bindings.write === null) throw new FileBindingError(FILE_WRITE_SLOT)
        await store.remove(bindings.write, recordType, recordId, field, key)
    },
})
