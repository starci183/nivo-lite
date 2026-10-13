import { Injectable } from "@nestjs/common"
import { ShiftsDataService } from "./shifts-data.service"
import { ShiftsTextService } from "./shifts-text.service"
import type { Shift } from "./shifts.contracts"
import { toShift } from "./policies/row-mappers.policy"
import { coverCandidates } from "./policies/swap-rules.policy"
import { addDays, mondayOf } from "./policies/time.policy"

/** How many open shifts the managers are told about, and how many names each gets. */
const MAX_SHIFTS = 6
const MAX_NAMES = 3
const WORKING: ReadonlyArray<string> = ["draft", "published", "swapped"]

@Injectable()
/** Who could cover an open shift right now: the people who are qualified, free and inside every rule. */
export class ShiftsCoverService {
    constructor(
        private readonly data: ShiftsDataService,
        private readonly words: ShiftsTextService,
    ) {}

    /** One line per open shift, with the names of the people who could take it. */
    async suggestions(workspaceId: string, shiftIds: ReadonlyArray<string>, leaver: string): Promise<Array<string>> {
        const setup = await this.data.loadSetup(workspaceId, false)
        const rows = await Promise.all(shiftIds.slice(0, MAX_SHIFTS).map((id) => this.data.shiftRow(workspaceId, id)))
        return Promise.all(
            rows
                .flatMap((row) => (row === undefined ? [] : [row]))
                .map(async (row) => {
                    const shift: Shift = { ...toShift(row), staffId: null }
                    const monday = mondayOf(shift.date)
                    const env = await this.data.loadEnv(workspaceId, monday, setup)
                    const week = await this.data.rangeShifts(workspaceId, monday, addDays(monday, 6), WORKING)
                    const names = coverCandidates(setup, env, shift, week, [leaver])
                        .slice(0, MAX_NAMES)
                        .map((person) => person.name)
                    const line = this.words.line(setup, shift)
                    return names.length === 0
                        ? this.words.text("shifts.leaveGapNobody", { line })
                        : this.words.text("shifts.leaveGapAsk", { line, names: names.join(", ") })
                }),
        )
    }
}
