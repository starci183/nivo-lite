import { Command } from "@nestjs/cqrs"
import type { LinkStaffOutput } from "@modules/domain/hiring"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { LinkHiringStaffRequest } from "./link-hiring-staff.contracts"

/** Asks for create a staff profile from a hired candidate. */
export class LinkHiringStaffCommand extends Command<LinkStaffOutput> {
    constructor(readonly params: ExecuteParams<LinkHiringStaffRequest>) {
        super()
    }
}
