import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { OfficeLog } from "@modules/domain/module-ops"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { RECORD_NOTIFICATION } from "./persistence/shifts.sql"

/** Where a message to a person is recorded. */
export interface StaffNotice {
    /** The person. */
    readonly staffId: string
    /** What the message is about: publish, swap, leave or reminder. */
    readonly kind: string
    /** The message. */
    readonly body: string
    /** The schedule it is about, when there is one. */
    readonly scheduleId?: string
    /** The shift it is about, when there is one. */
    readonly shiftId?: string
}

@Injectable()
/** Messages the shifts send: to a person, recorded as their notice (the Office app shows it), and to the managers, written into the Office. */
export class ShiftsNotifyService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly office: OfficeLog,
    ) {}

    /** Records one message to a person. */
    async toStaff(workspaceId: string, notice: StaffNotice): Promise<void> {
        await this.entityManager.query(RECORD_NOTIFICATION, [
            workspaceId,
            notice.staffId,
            notice.scheduleId ?? null,
            notice.shiftId ?? null,
            notice.kind,
            "office",
            "sent",
            notice.body,
        ])
    }

    /** Writes one line for the managers into the Office. */
    async toManagers(workspaceId: string, body: string): Promise<void> {
        await this.office.postOffice(workspaceId, body)
    }
}
