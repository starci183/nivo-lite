import { Injectable } from "@nestjs/common"
import { AutomationsError, AutomationsErrorCode } from "@modules/domain/automations"
import type { AutomationGate, AutomationOffice, AutomationRecords, GateOutcome } from "@modules/domain/automations"
import type { FlowGate, FlowResult } from "@modules/domain/flows"

/** Refuses a call of a port whose owner has not bound it yet; the refusal names the port, so nothing fails silently. */
const pending = (port: string): Promise<never> =>
    Promise.reject(new AutomationsError({ code: AutomationsErrorCode.PortPending, params: { port } }))

@Injectable()
/**
 * Stands in for the ports the automations need from capabilities that land in other lanes: the authority gate, Office, the lead and
 * contract records and the flow engine. The lane that owns a capability binds its own service to the token and removes
 * the token from this module.
 */
export class AutomationPortsService implements AutomationGate, AutomationOffice, AutomationRecords, FlowGate {
    /** The authority gate is not bound. */
    submit(): Promise<GateOutcome> {
        return pending("gate")
    }

    /** Office is not bound. */
    postLine(): Promise<void> {
        return pending("office")
    }

    /** Office is not bound. */
    logEvidence(): Promise<void> {
        return pending("office")
    }

    /** Office is not bound. */
    openFollowUp(): Promise<boolean> {
        return pending("office")
    }

    /** The lead records are not bound. */
    createLead(): Promise<string> {
        return pending("records")
    }

    /** The contract records are not bound. */
    attachContractLead(): Promise<void> {
        return pending("records")
    }

    /** The flow engine is not bound. */
    run(): Promise<FlowResult> {
        return pending("flows")
    }
}
