import { Injectable } from "@nestjs/common"
import { ApprovalGate } from "./approval-gate.port"
import { ModuleOpsError, ModuleOpsErrorCode } from "./errors/module-ops.error"
import type { ModuleApprovalResult } from "./module-ops.contracts"

@Injectable()
/** The gate used until the decisions capability is connected: every ask is refused with a typed unavailable error, so nothing runs without a decision. */
export class UnavailableApprovalGateService extends ApprovalGate {
    /** Refuses: no gate decides yet. */
    override request(): Promise<ModuleApprovalResult> {
        return Promise.reject(new ModuleOpsError({ code: ModuleOpsErrorCode.GateUnavailable }))
    }

    /** Refuses: no gate decides yet. */
    override decide(): Promise<ModuleApprovalResult> {
        return Promise.reject(new ModuleOpsError({ code: ModuleOpsErrorCode.GateUnavailable }))
    }
}
