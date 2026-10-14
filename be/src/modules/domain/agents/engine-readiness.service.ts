import { InjectOpenclawAgentRegistry, InjectOpenclawGateway } from "@modules/integrations/openclaw"
import type { AgentRegistryService, GatewayClient } from "@modules/integrations/openclaw"
import type { EngineAvailability } from "./agents.contracts"

/** Any agent id works for the probe: only whether a config directory is set matters. */
const PROBE_AGENT = "probe"

/** Reads the gateway configuration and workspace readiness used by every engine status view. */
export class EngineReadinessService {
    /** Captures the engine ports without reading their current configuration or workspace readiness. */
    constructor(
        @InjectOpenclawGateway() private readonly gateway: GatewayClient,
        @InjectOpenclawAgentRegistry() private readonly registry: AgentRegistryService,
    ) {}

    /** Whether a gateway is configured now. */
    configured(): boolean {
        return this.gateway.enabled
    }

    /** Whether the configured agent workspace directory can be written now. */
    writable(): boolean {
        return this.registry.workspaceDirs(PROBE_AGENT) !== null
    }

    /** Whether the engine can answer, checking workspace readiness only for a configured gateway. */
    availability(): EngineAvailability {
        if (!this.configured()) return "not_configured"
        return this.writable() ? "ready" : "offline"
    }
}
