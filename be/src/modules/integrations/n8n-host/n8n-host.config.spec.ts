import { homedir } from "node:os"
import { join } from "node:path"
import { Test } from "@nestjs/testing"
import { EnvSource } from "@modules/platform/config"
import { parseN8nHostConfig } from "./n8n-host.config"

const N8N_HOST_CONFIG = Symbol("N8N_HOST_CONFIG")

const read = async (values: Record<string, string>) => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            { provide: EnvSource, useValue: new EnvSource(values) },
            { provide: N8N_HOST_CONFIG, useFactory: parseN8nHostConfig, inject: [EnvSource] },
        ],
    }).compile()
    return moduleRef.get(N8N_HOST_CONFIG)
}

describe("parseN8nHostConfig", () => {
    it("expands the default key under the home directory and names the local container", async () => {
        await expect(read({})).resolves.toEqual({
            host: undefined,
            user: "nivo",
            keyPath: join(homedir(), "/.nivo-lite/vps_ed25519"),
            knownHostsPath: undefined,
            container: "nivo-engine-n8n-1",
        })
    })

    it("keeps an absolute key and expands a declared known-hosts path", async () => {
        await expect(
            read({
                VPS_HOST: "vps.example",
                VPS_USER: "deploy",
                VPS_SSH_KEY: "/keys/id_ed25519",
                VPS_KNOWN_HOSTS: "~/known_hosts",
                N8N_CONTAINER: "n8n-1",
            }),
        ).resolves.toEqual({
            host: "vps.example",
            user: "deploy",
            keyPath: "/keys/id_ed25519",
            knownHostsPath: join(homedir(), "/known_hosts"),
            container: "n8n-1",
        })
    })
})
