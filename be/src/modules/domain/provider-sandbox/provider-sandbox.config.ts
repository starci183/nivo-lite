import type { EnvSource } from "@modules/platform/config"
import type { ProviderSandboxSwitch } from "./provider-sandbox.contracts"

/**
 * THE ONE READ of the sandbox's dev switch (ruling R60): `PROVIDER_SANDBOX_ENABLED` is `true` in the dev stack and absent (off) in
 * production. Off: no sandbox account can be opened, every sandbox implementation refuses (`PROVIDER_SANDBOX_OFF`), no webhook accepts
 * a sandbox key, and the API says the sandbox is off. Never a secret.
 */
export const parseProviderSandboxConfig = (env: EnvSource): ProviderSandboxSwitch => ({
    enabled: env.optional("PROVIDER_SANDBOX_ENABLED") === "true",
})
