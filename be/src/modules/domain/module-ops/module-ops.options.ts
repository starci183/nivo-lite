import type { Type } from "@nestjs/common"
import type { ActionPerformerRegistry } from "./action-performer.port"
import type { ApprovalGate } from "./approval-gate.port"
import type { OutboundMail } from "./outbound-mail.port"
import type { ModuleTextGenerator } from "./text-generator.port"

/** The classes of the capabilities that implement the module-ops ports; the app root passes them and the module binds each port to them. */
export interface ModuleOpsPorts {
    /** Implements the performer registry (the decisions capability, so a performer is reachable by the work engine). */
    readonly performers: Type<ActionPerformerRegistry>
    /** Implements the approval gate (the decisions capability). */
    readonly approvalGate: Type<ApprovalGate>
    /** Implements the workspace mailer (the email-messages capability). */
    readonly outboundMail: Type<OutboundMail>
    /** Implements the text generator (the ai-generations capability). */
    readonly textGenerator: Type<ModuleTextGenerator>
}

/** The options of the module-ops capability. */
export interface ModuleOpsOptions {
    /** The classes of the other capabilities behind the ports. */
    readonly ports: ModuleOpsPorts
}
