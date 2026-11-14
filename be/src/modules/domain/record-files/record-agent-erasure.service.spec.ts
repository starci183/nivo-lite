import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import { EntityEngineService, EntityMutationService } from "@modules/domain/entity-engine"
import type { StorageFilesPort } from "@modules/integrations/object-storage"
import { LOGGER, type Logger } from "@modules/platform/logging"
import { RecordAgentErasureService } from "./record-agent-erasure.service"
import { RECORD_FILES_STORAGE } from "./record-files.decorators"
import { RecordFilesLogEvent } from "./record-files.log-events"

const WS = "11111111-1111-4111-8111-111111111111"
const AGENT = "22222222-2222-4222-8222-222222222222"

const build = async () => {
    const engine = mock<EntityEngineService>()
    const mutations = mock<EntityMutationService>()
    const storage = mock<StorageFilesPort>()
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            RecordAgentErasureService,
            { provide: EntityEngineService, useValue: engine },
            { provide: EntityMutationService, useValue: mutations },
            { provide: RECORD_FILES_STORAGE, useValue: storage },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { engine, mutations, storage, logger, service: moduleRef.get(RecordAgentErasureService) }
}

describe("RecordAgentErasureService: an agent's records and files die with it", () => {
    it("answers the footprint the engine counts, in the agent's own scope", async () => {
        const { engine, service } = await build()
        const footprint = { types: [{ type: "blocks-core.chatbot.message", count: 2 }], records: 2, files: 1 }
        engine.footprintOf.mockResolvedValue(footprint)

        await expect(service.footprintOf(WS, AGENT)).resolves.toEqual(footprint)
        expect(engine.footprintOf).toHaveBeenCalledWith(WS, AGENT)
    })

    it("erases the records inside the caller's transaction and answers the file keys, removing nothing yet", async () => {
        const { mutations, storage, service } = await build()
        const em = mockEntityManager()
        mutations.eraseForAgent.mockResolvedValue({ erased: 3, files: ["k-1", "k-2"] })

        await expect(service.erase(WS, AGENT, em)).resolves.toEqual({ records: 3, files: ["k-1", "k-2"] })
        expect(mutations.eraseForAgent).toHaveBeenCalledWith(WS, AGENT, em)
        expect(storage.remove).not.toHaveBeenCalled()
    })

    it("removes the files from the one records bucket once asked, and keeps (and logs) an object the store cannot remove", async () => {
        const { storage, logger, service } = await build()
        storage.remove
            .mockResolvedValueOnce({ kind: "ok", value: null })
            .mockResolvedValueOnce({ kind: "refused", code: "OBJECT_STORAGE_UNAVAILABLE" })
            .mockResolvedValueOnce({ kind: "ok", value: null })

        await service.removeFiles(["k-1", "k-2", "k-3"])

        expect(storage.remove.mock.calls).toEqual([["k-1"], ["k-2"], ["k-3"]])
        expect(logger.warn).toHaveBeenCalledTimes(1)
        expect(logger.warn).toHaveBeenCalledWith(RecordFilesLogEvent.ObjectKept, { code: "OBJECT_STORAGE_UNAVAILABLE" })
    })
})
