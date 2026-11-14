import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { ConnectionSecretsService } from "@modules/domain/connection-secrets"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectInbox, type Inbox } from "@modules/platform/inbox"
import { parseJsonText } from "@modules/platform/primitives"
import { ToolReceiptsError, ToolReceiptsErrorCode } from "./errors/tool-receipts.error"
import type { ToolCallResult, ToolJson, ToolReceiptOperation } from "./tool-receipts.contracts"
import { ToolReceiptEntity } from "./persistence/entities"

const PENDING: ToolCallResult = { ok: false, code: "unknown_outcome", detail: "operation_pending" }

const FAILURE_CODES: ReadonlySet<string> = new Set([
    "invalid_name",
    "unknown_tool",
    "not_granted",
    "idempotency_key_required",
    "unavailable",
    "tool_error",
    "unknown_outcome",
])
const APPROVAL_REASONS: ReadonlySet<string> = new Set([
    "ask_mode",
    "outside_write",
    "over_constraint",
    "over_limit_vnd",
    "no_rule",
    "tainted_input",
])

const isObject = (value: unknown): value is ToolJson =>
    typeof value === "object" && value !== null && !Array.isArray(value)

/** Refuses corrupt receipt data before it can become a connector answer. */
const isResult = (value: unknown): value is ToolCallResult => {
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
export class ToolReceiptsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectInbox() private readonly inbox: Inbox,
        private readonly secrets: ConnectionSecretsService,
    ) {}

    /** Claims and records pending intent atomically, then calls once; a retry reads the pending or completed outcome. */
    async run(workspaceId: string, key: string, operation: ToolReceiptOperation): Promise<ToolCallResult> {
        const previous = await this.entityManager.transaction(async (manager) => {
            if (!(await this.inbox.claim("mcp.gateway", `${workspaceId}:${key}`, manager))) {
                return this.read(workspaceId, key, manager)
            }
            await manager.insert(ToolReceiptEntity, {
                workspaceId,
                operationKey: key,
                resultSealed: this.secrets.seal(JSON.stringify(PENDING)),
            })
            return null
        })
        if (previous !== null) return previous
        const result = await operation()
        await this.entityManager.update(
            ToolReceiptEntity,
            { workspaceId, operationKey: key },
            { resultSealed: this.secrets.seal(JSON.stringify(result)) },
        )
        return result
    }

    private async read(workspaceId: string, key: string, manager: EntityManager): Promise<ToolCallResult> {
        const row = await manager.findOne(ToolReceiptEntity, {
            select: { resultSealed: true },
            where: { workspaceId, operationKey: key },
        })
        if (row === null) throw new ToolReceiptsError({ code: ToolReceiptsErrorCode.Unreadable })
        const opened = this.secrets.open(row.resultSealed)
        if (opened.kind !== "ok") throw new ToolReceiptsError({ code: ToolReceiptsErrorCode.Unreadable })
        const parsed = parseJsonText(opened.value)
        if (!parsed.ok || !isResult(parsed.value))
            throw new ToolReceiptsError({ code: ToolReceiptsErrorCode.Unreadable })
        return parsed.value
    }
}
