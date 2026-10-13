import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SetSyncScheduleRequest } from "./set-sync-schedule.contracts"

/** Sets how often a data connection syncs by itself. */
export class SetSyncScheduleCommand extends Command<void> {
    constructor(readonly params: ExecuteParams<SetSyncScheduleRequest>) {
        super()
    }
}
