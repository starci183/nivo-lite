import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { Secret } from "@modules/platform/config"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { fakeStorage } from "@tests/fixtures/doubles/fake-storage.client"
import type { StorageClient } from "./object-storage.contracts"
import { StorageBootstrapService } from "./object-storage-bootstrap.service"
import { STORAGE_CLIENT, STORAGE_OPTIONS } from "./storage.decorators"
import type { ObjectStorageOptions } from "./storage.options"

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
        const client = mock<StorageClient>()
        const { buckets } = fakeStorage(client)
        const moduleRef = await Test.createTestingModule({
            providers: [
                StorageBootstrapService,
                { provide: STORAGE_CLIENT, useValue: client },
                { provide: STORAGE_OPTIONS, useValue: options },
                { provide: LOGGER, useValue: mock<Logger>() },
            ],
        }).compile()

        await moduleRef.get(StorageBootstrapService).bootstrap()

        expect(Object.fromEntries(buckets)).toEqual({
            "nivo-avatars-public": true,
            "nivo-media": false,
            "nivo-videos": false,
            "nivo-hiring": false,
            "nivo-knowledge-uploads": false,
        })
    })
})
