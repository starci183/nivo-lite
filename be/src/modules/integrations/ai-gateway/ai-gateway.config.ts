import type { EnvSource } from "@modules/platform/config"
import type { AiGatewayOptions } from "./ai-gateway.options"
import { aiGatewayOf } from "./ai-gateway-config.policy"

/** Reads the AI gateway from the environment; the API process hosts the gateway. No key is required. */
export const parseAiGatewayConfig = (env: EnvSource): AiGatewayOptions => aiGatewayOf(env)
