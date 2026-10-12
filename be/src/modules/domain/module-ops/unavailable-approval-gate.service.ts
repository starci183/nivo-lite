import { Injectable } from "@nestjs/common"
import { ApprovalGate } from "./approval-gate.port"
import { ModuleOpsError, ModuleOpsErrorCode } from "./errors/module-ops.error"
import type { ApprovalResult } from "./module-ops.contracts"

@Injectable()
/** The gate used until the decisions capability is connected: every ask is refused with a typed unavailable error, so nothing runs without a decision. */
export class UnavailableApprovalGateService extends ApprovalGate {
    /** Refuses: no gate decides yet. */
    override request(): Promise<ApprovalResult> {
        return Promise.reject(new ModuleOpsError({ code: ModuleOpsErrorCode.GateUnavailable }))
    }

    /** Refuses: no gate decides yet. */
    override decide(): Promise<ApprovalResult> {
        return Promise.reject(new ModuleOpsError({ code: ModuleOpsErrorCode.GateUnavailable }))
    }
}
