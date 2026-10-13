import type { EnvSource } from "@modules/platform/config"
import type { ChannelProvisioningOptions } from "./channel-provisioning.options"

/** Reads the connect-channel settings from the environment: the secrets are never command line arguments, so they stay out of the shell history. */
export const parseChannelProvisioningConfig = (
    env: EnvSource,
    print: (line: string) => void,
): ChannelProvisioningOptions => ({
    telegramToken: env.has("CHANNEL_BOT_TOKEN") ? env.secret("CHANNEL_BOT_TOKEN") : undefined,
    print,
})
