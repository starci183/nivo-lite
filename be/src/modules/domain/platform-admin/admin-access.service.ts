import { Injectable } from "@nestjs/common"
import { PlatformAuditService } from "@modules/domain/platform-audit"
import type { Principal } from "@modules/platform/cqrs"
import { PlatformAdminError, PlatformAdminErrorCode } from "./errors/platform-admin.error"
import type { AdminIdentity } from "./platform-admin.contracts"
import { InjectPlatformAdminOptions } from "./platform-admin.decorators"
import type { PlatformAdminOptions } from "./platform-admin.options"
import { isPlatformAdmin } from "./platform-admin.policy"

/** The workspace an action touched, or null when it touched none. */
export type OptionalWorkspaceId = string | null

/** What the audit trail keeps beside an action, by key. */
export interface AuditData {
    readonly [key: string]: unknown
}

@Injectable()
/** Who may use the console, and the audit trail of everything they view or change. */
export class AdminAccessService {
    constructor(
        private readonly audits: PlatformAuditService,
        @InjectPlatformAdminOptions() private readonly options: PlatformAdminOptions,
    ) {}

    /** The platform admin behind a request; anyone else gets the same not-found a missing page gets. */
    requireAdmin(principal: Principal): AdminIdentity {
        if (principal.email === undefined || !isPlatformAdmin(principal.email, this.options.admins)) {
            throw new PlatformAdminError({ code: PlatformAdminErrorCode.NotFound })
        }
        return { userId: principal.id, email: principal.email.trim().toLowerCase() }
    }

    /** Writes what the admin viewed or changed; the trail never fails the request. */
    audit(admin: AdminIdentity, action: string, workspaceId: OptionalWorkspaceId, data: AuditData = {}): Promise<void> {
        return this.audits.record({ actorId: admin.userId, actorEmail: admin.email, action, workspaceId, data })
    }
}
