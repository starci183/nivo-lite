import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { OBJECT_STORAGE } from "@starci/object-storage"
import { createMemoryObjectStorage } from "@starci/object-storage/testing"
import { Secret } from "@modules/platform/config"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { StorageBootstrapService } from "./object-storage-bootstrap.service"
import { STORAGE_OPTIONS } from "./object-storage.decorators"
import type { ObjectStorageOptions } from "./object-storage.options"

const options: ObjectStorageOptions = {
    endpoint: "https://academy-minio.test:9000",
    region: "us-east-1",
    accessKey: new Secret("a"),
    secretKey: new Secret("b"),
    bucketPrefix: "nivo",
    publicUrl: "https://minio.example.org",
    timeoutMs: 1000,
}

describe("StorageBootstrapService", () => {
    it("creates every bucket of the environment, the pictures public and the rest private", async () => {
        const storage = createMemoryObjectStorage()
        const moduleRef = await Test.createTestingModule({
            providers: [
                StorageBootstrapService,
                { provide: OBJECT_STORAGE, useValue: storage },
                { provide: STORAGE_OPTIONS, useValue: options },
                { provide: LOGGER, useValue: mock<Logger>() },
            ],
        }).compile()

        await moduleRef.get(StorageBootstrapService).bootstrap()

        expect([...storage.store.buckets.keys()]).toEqual([
            "nivo-avatars-public",
            "nivo-media",
            "nivo-videos",
            "nivo-hiring",
            "nivo-knowledge-uploads",
        ])
        expect([...storage.store.publicBuckets]).toEqual(["nivo-avatars-public"])
    })
})
