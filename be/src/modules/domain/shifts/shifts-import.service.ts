import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { ShiftsError, ShiftsErrorCode } from "./errors/shifts.error"
import { ShiftsDataService } from "./shifts-data.service"
import { ShiftsTextService } from "./shifts-text.service"
import type { ApplyImportOutput, ApplyImportParams } from "./shifts-operations.contracts"
import { APPLY_IMPORT } from "./persistence/shifts.sql"
import { MANAGER_ROLES } from "./policies/access-roles.policy"
import { parseImport, POSITION_COLORS } from "./policies/import-text.policy"

@Injectable()
/** The quick import: positions, people with their wage and the coverage typed as text become the setup of the shop. */
export class ShiftsImportService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly members: WorkspaceMembersService,
        private readonly data: ShiftsDataService,
        private readonly words: ShiftsTextService,
    ) {}

    /** Reads the text and, when every line is readable, adds what it describes; otherwise changes nothing. */
    async applyImport(userId: string, workspaceId: string, request: ApplyImportParams): Promise<ApplyImportOutput> {
        await this.members.require(userId, workspaceId, MANAGER_ROLES)
        const setup = await this.data.loadSetup(workspaceId, false)
        const parsed = parseImport(
            request,
            setup.positions.map((position) => position.name),
        )
        const first = parsed.errors[0]
        if (first !== undefined) {
            throw new ShiftsError({
                code: ShiftsErrorCode.ImportLines,
                params: {
                    count: parsed.errors.length,
                    line: first.line,
                    reason: this.words.text(`shifts.import.${first.code}`, { subject: first.subject }),
                },
            })
        }
        if (parsed.positions.length === 0 && parsed.staff.length === 0 && parsed.blocks.length === 0) {
            throw new ShiftsError({ code: ShiftsErrorCode.ImportEmpty })
        }
        const taken = setup.positions.length
        const [counts] = await this.entityManager.query<Array<{ counts: ApplyImportOutput }>>(APPLY_IMPORT, [
            workspaceId,
            JSON.stringify(
                parsed.positions.map((name, index) => ({
                    name,
                    color: POSITION_COLORS[(taken + index) % POSITION_COLORS.length],
                })),
            ),
            JSON.stringify(parsed.staff),
            JSON.stringify(parsed.blocks),
        ])
        return counts?.counts ?? { positions: 0, staff: 0, blocks: 0 }
    }
}
