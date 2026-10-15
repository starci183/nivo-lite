import type { ModuleMetadata } from "@nestjs/common"
import { LEADS_ERROR_KINDS, LEADS_MESSAGES } from "@modules/domain/leads"
import { LEAD_FLOWS_ERROR_KINDS, LEAD_FLOWS_MESSAGES, LeadGenIntakeService } from "@modules/domain/lead-flows"
import { AppCommandsModule } from "@modules/domain/app-commands"
import { CONTRACTS_ERROR_KINDS, CONTRACTS_MESSAGES, ContractsModule } from "@modules/domain/contracts"
import { LIVENESS_ERROR_KINDS, LIVENESS_MESSAGES, LivenessModule } from "@modules/domain/liveness"

/** Register the app-wide system capabilities. */
export const systemCapabilities = (): NonNullable<ModuleMetadata["imports"]> => [
    AppCommandsModule.register({ isGlobal: true }),
    ContractsModule.register({ isGlobal: true }),
    LivenessModule.register({ isGlobal: true }),
]

/** Message bundles and error kinds of the system capabilities above. */
export const API_SYSTEM = {
    messages: [CONTRACTS_MESSAGES, LIVENESS_MESSAGES],
    kinds: [CONTRACTS_ERROR_KINDS, LIVENESS_ERROR_KINDS],
} as const

/** The leads and the lead generation flow: their texts and error kinds, and the two capabilities the app root registers globally. */
export const LEAD_LANE = {
    messages: [LEADS_MESSAGES, LEAD_FLOWS_MESSAGES],
    kinds: [LEADS_ERROR_KINDS, LEAD_FLOWS_ERROR_KINDS],
    metaTaker: LeadGenIntakeService,
}
