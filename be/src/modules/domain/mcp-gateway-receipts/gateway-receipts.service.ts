import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { ConnectionSecretsService } from "@modules/domain/connection-secrets"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectInbox } from "@modules/platform/inbox"
import type { Inbox } from "@modules/platform/inbox"
import { parseJsonText } from "@modules/platform/primitives"
import { McpGatewayReceiptsError, McpGatewayReceiptsErrorCode } from "./errors/mcp-gateway-receipts.error"
import type { GatewayCallResult, GatewayJson, GatewayReceiptOperation } from "./mcp-gateway-receipts.contracts"
import {
    INSERT_GATEWAY_RECEIPT,
    SELECT_GATEWAY_RECEIPT,
    UPDATE_GATEWAY_RECEIPT,
} from "./persistence/gateway-receipts.sql"

const PENDING: GatewayCallResult = { ok: false, code: "unknown_outcome", detail: "operation_pending" }

const FAILURE_CODES: ReadonlySet<string> = new Set([
    "invalid_name",
    "unknown_tool",
    "connector_disabled",
    "schema_unapproved",
    "not_granted",
    "idempotency_key_required",
    "unavailable",
    "tool_error",
    "unknown_outcome",
])
const APPROVAL_REASONS: ReadonlySet<string> = new Set(["ask_mode", "over_constraint", "over_limit_vnd", "no_rule"])

const isObject = (value: unknown): value is GatewayJson =>
    typeof value === "object" && value !== null && !Array.isArray(value)

/** Refuses corrupt receipt data before it can become a connector answer. */
const isResult = (value: unknown): value is GatewayCallResult => {
    if (!isObject(value)) return false
    if (value.ok === true) return isObject(value.value)
    if (value.ok !== false) return false
    if (value.code === "approval_required") {
        return typeof value.reason === "string" && APPROVAL_REASONS.has(value.reason)
    }
    return typeof value.code === "string" && FAILURE_CODES.has(value.code) && typeof value.detail === "string"
}

@Injectable()
/** Commits sealed connector intent before an external effect, so a retry cannot reissue an operation after a crash. */
export class GatewayReceiptsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectInbox() private readonly inbox: Inbox,
        private readonly secrets: ConnectionSecretsService,
    ) {}

    /** Claims and records pending intent atomically, then calls once; a retry reads the pending or completed outcome. */
    async run(workspaceId: string, key: string, operation: GatewayReceiptOperation): Promise<GatewayCallResult> {
        const previous = await this.entityManager.transaction(async (manager) => {
            if (!(await this.inbox.claim("mcp.gateway", `${workspaceId}:${key}`, manager))) {
                return this.read(workspaceId, key, manager)
            }
            await manager.query(INSERT_GATEWAY_RECEIPT, [workspaceId, key, this.secrets.seal(JSON.stringify(PENDING))])
            return null
        })
        if (previous !== null) return previous
        const result = await operation()
        await this.entityManager.query(UPDATE_GATEWAY_RECEIPT, [
            workspaceId,
            key,
            this.secrets.seal(JSON.stringify(result)),
        ])
        return result
    }

    private async read(workspaceId: string, key: string, manager: EntityManager): Promise<GatewayCallResult> {
        const [row] = await manager.query<Array<{ readonly result_sealed: string }>>(SELECT_GATEWAY_RECEIPT, [
            workspaceId,
            key,
        ])
        if (row === undefined) throw new McpGatewayReceiptsError({ code: McpGatewayReceiptsErrorCode.Unreadable })
        const opened = this.secrets.open(row.result_sealed)
        if (opened.kind !== "ok") throw new McpGatewayReceiptsError({ code: McpGatewayReceiptsErrorCode.Unreadable })
        const parsed = parseJsonText(opened.value)
        if (!parsed.ok || !isResult(parsed.value))
            throw new McpGatewayReceiptsError({ code: McpGatewayReceiptsErrorCode.Unreadable })
        return parsed.value
    }
}
