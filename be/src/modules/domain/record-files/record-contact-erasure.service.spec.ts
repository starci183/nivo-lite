import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { EntityMutationService } from "@modules/domain/entity-engine"
import type { StorageFilesPort } from "@modules/integrations/object-storage"
import { LOGGER, type Logger } from "@modules/platform/logging"
import { RecordContactErasureService } from "./record-contact-erasure.service"
import { RECORD_FILES_STORAGE } from "./record-files.decorators"
import { RecordFilesLogEvent } from "./record-files.log-events"

const WS = "11111111-1111-4111-8111-111111111111"
const CONTACT = "33333333-3333-4333-8333-333333333333"

const build = async () => {
    const mutations = mock<EntityMutationService>()
    const storage = mock<StorageFilesPort>()
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            RecordContactErasureService,
            { provide: EntityMutationService, useValue: mutations },
            { provide: RECORD_FILES_STORAGE, useValue: storage },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { mutations, storage, logger, erasure: moduleRef.get(RecordContactErasureService) }
}

describe("RecordContactErasureService: a deleted contact leaves no record and no file", () => {
    it("erases the records, then removes the files of the erased ones from the store", async () => {
        const { mutations, storage, erasure } = await build()
        mutations.eraseForContacts.mockResolvedValue({ kind: "erased", erased: 2, cleared: 1, files: ["k-1", "k-2"] })
        storage.remove.mockResolvedValue({ kind: "ok", value: null })

        await expect(erasure.erase(WS, [CONTACT])).resolves.toEqual({ kind: "erased", records: 2, cleared: 1 })
        expect(mutations.eraseForContacts).toHaveBeenCalledWith(WS, [CONTACT])
        expect(storage.remove.mock.calls).toEqual([["k-1"], ["k-2"]])
    })

    it("keeps (and logs) an object the store cannot remove: the records are already gone", async () => {
        const { mutations, storage, logger, erasure } = await build()
        mutations.eraseForContacts.mockResolvedValue({ kind: "erased", erased: 1, cleared: 0, files: ["k-1"] })
        storage.remove.mockResolvedValue({ kind: "refused", code: "OBJECT_STORAGE_UNAVAILABLE" })

        await expect(erasure.erase(WS, [CONTACT])).resolves.toEqual({ kind: "erased", records: 1, cleared: 0 })
        expect(logger.warn).toHaveBeenCalledWith(RecordFilesLogEvent.ObjectKept, { code: "OBJECT_STORAGE_UNAVAILABLE" })
    })

    it("answers the blocking ref and removes nothing", async () => {
        const { mutations, storage, erasure } = await build()
        mutations.eraseForContacts.mockResolvedValue({ kind: "blocked", relation: "order" })

        await expect(erasure.erase(WS, [CONTACT])).resolves.toEqual({ kind: "blocked", relation: "order" })
        expect(storage.remove).not.toHaveBeenCalled()
    })
})
