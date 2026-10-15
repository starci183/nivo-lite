import { AgentKnowledgeLensService, ModuleProfilesService } from "@modules/domain/agent-knowledge"
import { CustomerOutcomesService, CustomerTurnRuntimeService } from "@modules/domain/customer-turns"
import { InstallationDirectoryService } from "@modules/domain/modules"
import { DECISIONS_ERROR_KINDS, DECISIONS_MESSAGES, DecisionCorrectionsService } from "@modules/domain/decisions"
import { AUTOMATIONS_ERROR_KINDS, AUTOMATIONS_MESSAGES } from "@modules/domain/automations"
import { MODULE_OPS_ERROR_KINDS, MODULE_OPS_MESSAGES } from "@modules/domain/module-ops"
import { AUTOMATION_PORTS_MESSAGES } from "@modules/domain/automation-ports"
import { BOOKING_PORTS_MESSAGES } from "@modules/domain/booking-ports"
import { FLOW_ENGINE_ERROR_KINDS, FLOW_ENGINE_MESSAGES } from "@modules/domain/flow-engine"
import { DriveGrantService } from "@modules/domain/google-connections"
import { BOOKING_PORTS, MODULE_OPS_PORTS } from "../api.options"

/**
 * The ports G19 plugs in: the installations, knowledge lens and module profiles the agents capability reads, the AI step and
 * outcome handler of every customer chat turn, and the connection points of the automations, business modules and decisions.
 */
export const G19_PORTS = {
    agents: {
        installations: InstallationDirectoryService,
        knowledge: AgentKnowledgeLensService,
        modules: ModuleProfilesService,
    },
    chatTurn: { runtime: CustomerTurnRuntimeService, outcomes: CustomerOutcomesService },
    /** The decisions source the brain studies for corrections. */
    brain: { corrections: DecisionCorrectionsService },
    bookings: BOOKING_PORTS,
    /** The message bundles of automations, decisions, module-ops, automation ports, booking ports and flow engine. */
    messages: [
        AUTOMATIONS_MESSAGES,
        DECISIONS_MESSAGES,
        MODULE_OPS_MESSAGES,
        AUTOMATION_PORTS_MESSAGES,
        BOOKING_PORTS_MESSAGES,
        FLOW_ENGINE_MESSAGES,
    ],
    /** Their error kind tables. */
    errorKinds: [AUTOMATIONS_ERROR_KINDS, DECISIONS_ERROR_KINDS, MODULE_OPS_ERROR_KINDS, FLOW_ENGINE_ERROR_KINDS],
    /** The ports of the business modules (hiring, shifts, inventory): the real gate, mailer and text generator. */
    moduleOps: MODULE_OPS_PORTS,
    /** The provider of the Google Drive access of a workspace, for the knowledge capability. */
    driveAccess: DriveGrantService,
}
