import { Injectable } from "@nestjs/common"
import {
    FILE_BYTES_CEILING,
    fileMimeOf,
    fileRefsOf,
    isFileList,
    isFileMime,
    type FieldDef,
    type FileRef,
} from "@nivo-lite/agent-sdk/entity"
import type { RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import { EntitlementsService } from "@modules/domain/billing"
import { EntityEngineService, EntityPortsService, type AgentScope, type RunIn } from "@modules/domain/entity-engine"
import {
    isRecordFileKeyOf,
    isStagedKeyOf,
    recordFileKeyOf,
    stagedKeyOf,
    type StorageFilesPort,
    type RecordFileSpot,
} from "@modules/integrations/object-storage"
import { InjectIds, type Ids } from "@modules/platform/ids"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { eachInOrder, type Outcome } from "@modules/platform/primitives"
import { RecordFilesError, RecordFilesErrorCode } from "./errors/record-files.error"
import type {
    ObjectFile,
    PutFile,
    RecordFileFacts,
    RecordFileRemoval,
    RecordFileTarget,
    RecordFileTicket,
    RecordFileUrl,
} from "./record-files.contracts"
import { InjectRecordFilesStorage } from "./record-files.decorators"
import { RecordFilesLogEvent } from "./record-files.log-events"
import { addedTo, fileFieldOf, fileNameOf, isRecordId, removedFrom, requireFits } from "./record-files.policy"
import { RecordFileFetchService } from "./record-files-fetch.service"

/** The refusal of the store: a missing object, or a store that could not be reached. */
const NOT_FOUND = "OBJECT_STORAGE_NOT_FOUND"

/** The field of a record a call proved: its spot in the store and its declaration. */
interface ProvedField {
    readonly spot: RecordFileSpot
    readonly field: FieldDef
    readonly row: RecordRow
    /** The agent whose own records the call is confined to; absent for a person's call. */
    readonly agent?: AgentScope
}

@Injectable()
/**
 * The ONE generic file store of the records (BIZ-MOVE G3): for every `file` field a package declares with `defineEntity`, with no code
 * per type. It does only: the record type and the field by the type's own declaration (a declared `file` field, its accepted types
 * and size limit); the workspace the caller proved, never one a payload names (the engine's scope: a record of another workspace is
 * not found); the key law of the one records bucket (an object belongs to exactly one workspace, record type, record and field); the
 * plan's storage room, by the same call every upload of the product makes (`EntitlementsService.requireStorageFor`). Who may call is
 * the caller's: the door's permissions, the node's declared record types.
 *
 * Two faces over the same verbs: `upload` + `confirm` (a person's bytes go straight to the store, the object is proved), `put` (a tool's
 * bytes: staged by a provider adapter or fetched from the address a provider answered), `link` (an object already in the store becomes
 * the record's reference), `url` (a short-lived signed read address) and `delete`. `link`, `put` and `delete` WRITE the field through
 * the engine's record write, where the type's declaration checks the reference again; the object the field held before is removed
 * from the store once the record no longer names it. Objects nobody ever links (an upload never confirmed or linked, a staged file
 * never put) are not swept here.
 *
 * A LIST field (`field.file({ many: true, max })`) holds an ordered list of references: `link` and `put` APPEND (or take the place of
 * the item `replaces` names, same position) while the list holds fewer than `max` (`ListFull` otherwise); `url` and `delete` name the
 * item by its object key (`ItemKeyRequired` without one). Every object lives under the field's own folder, so the guard that removes
 * only objects of this field holds for each item; the objects a write drops are the set difference of the list before and after.
 */
export class RecordFilesService {
    constructor(
        @InjectRecordFilesStorage() private readonly storage: StorageFilesPort,
        @InjectIds() private readonly ids: Ids,
        @InjectLogger() private readonly logger: Logger,
        private readonly engine: EntityEngineService,
        private readonly ports: EntityPortsService,
        private readonly entitlements: EntitlementsService,
        private readonly fetcher: RecordFileFetchService,
    ) {}

    /** A ticket to upload one file of `facts` into the field of an existing record of the workspace, within the plan's storage room. */
    async upload(workspaceId: string, target: RecordFileTarget, facts: RecordFileFacts): Promise<RecordFileTicket> {
        const proved = await this.proved(workspaceId, target)
        const mime = fileMimeOf(facts.mime)
        requireFits(proved.field, mime, facts.size)
        this.requireRoom(proved)
        await this.entitlements.requireStorageFor(workspaceId, facts.size)
        const key = recordFileKeyOf(proved.spot, this.ids.next())
        const signed = this.stored(await this.storage.signedUpload(key, mime, facts.size))
        return { key, url: signed.url, method: "PUT", headers: signed.headers, expiresAt: signed.expiresAt }
    }

    /**
     * The reference of an uploaded file once the store proves it: the key is one of this field of this record of the workspace, the
     * object is there, and the type and size the store recorded fit the field. An object that does not fit is removed from the store.
     * Nothing is written to the record: `link` does that.
     */
    async confirm(workspaceId: string, target: RecordFileTarget, key: string, name: string): Promise<FileRef> {
        return this.confirmed(await this.proved(workspaceId, target), key, name)
    }

    /**
     * Attaches an object already in the store to the field: a confirmed upload of THIS field of this record, or an object a tool staged
     * in the workspace (moved under the field's key). The reference is written to the record; the object the field held is removed.
     * Answers the reference.
     */
    async link(workspaceId: string, target: RecordFileTarget, file: ObjectFile): Promise<FileRef> {
        const proved = await this.proved(workspaceId, target)
        if (isStagedKeyOf(workspaceId, file.key)) return this.adoptStaged(proved, file.key, file.name, file.replaces)
        const held = fileRefsOf(proved.field, proved.row.data[target.field]).find((ref) => ref.key === file.key)
        if (held !== undefined && isFileList(proved.field)) return held
        if (file.replaces === undefined) this.requireRoom(proved)
        const ref = await this.confirmed(proved, file.key, file.name)
        await this.attach(proved, ref, false, file.replaces)
        return ref
    }

    /**
     * Stores a tool's file in the field and writes the reference to the record: either an object a provider tool staged in the
     * workspace (moved under the field's key) or the file at the public https address a provider answered (fetched once, server-side,
     * within the field's size and type limits and the plan's storage room). The object the field held is removed. Answers the reference.
     */
    async put(workspaceId: string, target: RecordFileTarget, file: PutFile): Promise<FileRef> {
        const proved = await this.proved(workspaceId, target)
        if ("staged" in file) return this.adoptStaged(proved, file.staged, file.name, file.replaces)
        if (file.replaces === undefined) this.requireRoom(proved)
        const fetched = await this.fetcher.fetch(file.url, proved.field)
        requireFits(proved.field, fetched.mime, fetched.bytes.byteLength)
        await this.entitlements.requireStorageFor(workspaceId, fetched.bytes.byteLength)
        const key = recordFileKeyOf(proved.spot, this.ids.next())
        this.stored(await this.storage.write(key, fetched.bytes, fetched.mime))
        const ref: FileRef = { key, mime: fetched.mime, size: fetched.bytes.byteLength, name: fileNameOf(file.name) }
        await this.attach(proved, ref, true, file.replaces)
        return ref
    }

    /**
     * A signed read address of the file the record holds in the field, read from the record itself (never a reference the caller
     * supplies): `NoFile` when the field is empty or holds no file of the key named (a list field names its item by `target.key`:
     * `ItemKeyRequired` without one), `KeyInvalid` when the stored reference is no object of this field of this record. It lives
     * `seconds` (the store's bounds: at least one second, at most seven days); one hour when the caller asks for none.
     */
    async url(workspaceId: string, target: RecordFileTarget, seconds?: number): Promise<RecordFileUrl> {
        const proved = await this.proved(workspaceId, target)
        const ref = this.itemOf(proved, target.key)
        if (ref === null) throw new RecordFilesError({ code: RecordFilesErrorCode.NoFile })
        if (!isRecordFileKeyOf(proved.spot, ref.key)) throw new RecordFilesError({ code: RecordFilesErrorCode.KeyInvalid })
        const signed = this.stored(await this.storage.signedLink(ref.key, seconds ?? Number.NaN, ref.name))
        return { url: signed.url, expiresAt: signed.expiresAt, name: ref.name, mime: ref.mime, size: ref.size }
    }

    /**
     * Clears the field's reference on the record and removes the object it named from the store. A field that holds no file is
     * left as it is (`removed` false); a reference that names no object of this field is cleared and removes nothing. A list field
     * removes the one item `target.key` names (`ItemKeyRequired` without a key) and keeps the others in their order; on a single field
     * a key that is not the held file's removes nothing.
     */
    async delete(workspaceId: string, target: RecordFileTarget): Promise<RecordFileRemoval> {
        const proved = await this.proved(workspaceId, target)
        if (isFileList(proved.field) && target.key === undefined) {
            throw new RecordFilesError({ code: RecordFilesErrorCode.ItemKeyRequired })
        }
        const { previous, held } = await this.write(proved, (before) => removedFrom(before, target.key))
        await this.dropped(proved.spot, previous, held)
        return { removed: previous.length > held.length }
    }

    /**
     * Stages bytes a provider adapter produced (a generated voice, a fetched picture) in the workspace, for a node to put on a record:
     * the adapter answers the staged key as its result, so no bytes travel through a graph, a model or a ledger. Answers the key.
     */
    async stage(workspaceId: string, bytes: Uint8Array, mime: string): Promise<string> {
        const type = fileMimeOf(mime)
        if (!isFileMime(type)) throw new RecordFilesError({ code: RecordFilesErrorCode.MimeNotAccepted })
        if (bytes.byteLength < 1 || bytes.byteLength > FILE_BYTES_CEILING) {
            throw new RecordFilesError({ code: RecordFilesErrorCode.SizeInvalid })
        }
        const key = stagedKeyOf(workspaceId, this.ids.next())
        this.stored(await this.storage.write(key, bytes, type))
        return key
    }

    /** The field's declaration and the record, once the type declares the field as a file and the record is in the workspace. */
    private async proved(workspaceId: string, target: RecordFileTarget): Promise<ProvedField> {
        const field = fileFieldOf(this.engine.catalog.get(target.type), target.field)
        if (!isRecordId(target.recordId)) throw new RecordFilesError({ code: RecordFilesErrorCode.RecordNotFound })
        const agent: AgentScope | undefined = target.agentId === undefined ? undefined : { id: target.agentId, sees: "own" }
        const row = await this.engine.scoped(
            workspaceId,
            (tx) => {
                const runIn: RunIn = (use) => use(tx)
                return this.ports.entitiesApi(runIn, "action").get(target.type, target.recordId)
            },
            agent,
        )
        if (row === null) throw new RecordFilesError({ code: RecordFilesErrorCode.RecordNotFound })
        const spot = { workspaceId, type: target.type, recordId: target.recordId, field: target.field }
        return agent === undefined ? { spot, field, row } : { spot, field, row, agent }
    }

    /** The reference of an object of this field of this record once the store proves it is there and fits (else removed). */
    private async confirmed(proved: ProvedField, key: string, name: string): Promise<FileRef> {
        if (!isRecordFileKeyOf(proved.spot, key)) throw new RecordFilesError({ code: RecordFilesErrorCode.KeyInvalid })
        const head = await this.storage.head(key)
        if (head.kind !== "ok") throw this.missingOr(head.code)
        await this.fitsOrRemoved(proved.field, key, head.value.mime, head.value.size)
        return { key, mime: head.value.mime, size: head.value.size, name: fileNameOf(name) }
    }

    /**
     * Moves a staged object of the workspace under the field's key and writes the reference; the staged object goes once the record
     * names the copy. The staged object must fit the field and the plan's storage room.
     */
    private async adoptStaged(proved: ProvedField, staged: string, name: string, replaces?: string): Promise<FileRef> {
        if (!isStagedKeyOf(proved.spot.workspaceId, staged)) {
            throw new RecordFilesError({ code: RecordFilesErrorCode.KeyInvalid })
        }
        if (replaces === undefined) this.requireRoom(proved)
        const head = await this.storage.head(staged)
        if (head.kind !== "ok") throw this.missingOr(head.code)
        await this.fitsOrRemoved(proved.field, staged, head.value.mime, head.value.size)
        await this.entitlements.requireStorageFor(proved.spot.workspaceId, head.value.size)
        const bytes = await this.storage.read(staged)
        if (bytes.kind !== "ok") throw this.missingOr(bytes.code)
        const key = recordFileKeyOf(proved.spot, this.ids.next())
        this.stored(await this.storage.write(key, bytes.value.bytes, head.value.mime))
        const ref: FileRef = { key, mime: head.value.mime, size: head.value.size, name: fileNameOf(name) }
        await this.attach(proved, ref, true, replaces)
        this.stored(await this.storage.remove(staged))
        return ref
    }

    /**
     * Writes `ref` to the record: a single field takes it in place of the file it held, a list field appends it (or, with `replaces`,
     * puts it where the named item was), and the objects the record no longer names are removed. When `owned` the object of `ref`
     * was created by this call, so it is removed again if the record does not take it.
     */
    private async attach(proved: ProvedField, ref: FileRef, owned: boolean, replaces?: string): Promise<void> {
        const { previous, held } = await this.write(proved, (before) =>
            addedTo(proved.field, before, ref, replaces),
        ).catch(async (cause: unknown) => {
            if (owned) await this.storage.remove(ref.key)
            throw cause
        })
        await this.dropped(proved.spot, previous, held)
    }

    /**
     * Writes the field of the record through the engine's record write (the type's declaration checks the value again), in one scoped
     * transaction with the read: `change` maps the references the record held to the ones it holds after (a single field is the list
     * of zero or one). Answers both, in order.
     */
    private async write(
        proved: ProvedField,
        change: (held: ReadonlyArray<FileRef>) => ReadonlyArray<FileRef>,
    ): Promise<{ readonly previous: ReadonlyArray<FileRef>; readonly held: ReadonlyArray<FileRef> }> {
        const { type, recordId, field } = proved.spot
        const list = isFileList(proved.field)
        const written = await this.engine.scoped(
            proved.spot.workspaceId,
            async (tx) => {
                const records = this.ports.entitiesApi((use) => use(tx), "action")
                const current = await records.get(type, recordId)
                if (current === null) return null
                const previous = fileRefsOf(proved.field, current.data[field])
                const held = change(previous)
                const value = list ? held : (held[0] ?? null)
                const result = await records.update(type, recordId, current.version, { [field]: value })
                return { result, previous, held }
            },
            proved.agent,
        )
        if (written === null || (!written.result.ok && written.result.reason === "missing")) {
            throw new RecordFilesError({ code: RecordFilesErrorCode.RecordNotFound })
        }
        if (!written.result.ok) throw new RecordFilesError({ code: RecordFilesErrorCode.RecordRejected })
        return { previous: written.previous, held: written.held }
    }

    /**
     * Removes the objects a record no longer names (the set difference of the references it held and the ones it holds now), but only
     * those that live under THIS field of this record (a reference that points elsewhere is never followed). A store that cannot
     * remove one leaves it and logs; the write already happened.
     */
    private async dropped(
        spot: RecordFileSpot,
        previous: ReadonlyArray<FileRef>,
        kept: ReadonlyArray<FileRef>,
    ): Promise<void> {
        const keptKeys = new Set(kept.map((ref) => ref.key))
        await eachInOrder(previous, async (ref) => {
            if (keptKeys.has(ref.key) || !isRecordFileKeyOf(spot, ref.key)) return
            const removed = await this.storage.remove(ref.key)
            if (removed.kind !== "ok") this.logger.warn(RecordFilesLogEvent.ObjectKept, { code: removed.code })
        })
    }

    /** Refuses a list field that already holds as many files as it may, from the record the call proved. */
    private requireRoom(proved: ProvedField): void {
        const { field } = proved
        if (!isFileList(field)) return
        if (fileRefsOf(field, proved.row.data[proved.spot.field]).length >= (field.max ?? 0)) {
            throw new RecordFilesError({ code: RecordFilesErrorCode.ListFull })
        }
    }

    /**
     * The file a call names, read from the record: the single field's file (when a key is named it must be that file), or the list's
     * item of that key; null when there is none. A list field without a key is `ItemKeyRequired`.
     */
    private itemOf(proved: ProvedField, key: string | undefined): FileRef | null {
        const refs = fileRefsOf(proved.field, proved.row.data[proved.spot.field])
        if (isFileList(proved.field)) {
            if (key === undefined) throw new RecordFilesError({ code: RecordFilesErrorCode.ItemKeyRequired })
            return refs.find((ref) => ref.key === key) ?? null
        }
        const only = refs[0]
        return only === undefined || (key !== undefined && only.key !== key) ? null : only
    }

    /** Refuses (and removes from the store) an object whose recorded type or size does not fit the field. */
    private async fitsOrRemoved(field: FieldDef, key: string, mime: string, size: number): Promise<void> {
        try {
            requireFits(field, mime, size)
        } catch (error) {
            await this.storage.remove(key)
            throw error
        }
    }

    /** The value of a store call, or the refusal of a store that could not be reached. */
    private stored<T>(outcome: Outcome<T, string>): T {
        if (outcome.kind !== "ok") throw this.missingOr(outcome.code)
        return outcome.value
    }

    private missingOr(code: string): RecordFilesError {
        return new RecordFilesError({
            code: code === NOT_FOUND ? RecordFilesErrorCode.UploadMissing : RecordFilesErrorCode.StoreUnavailable,
        })
    }
}
