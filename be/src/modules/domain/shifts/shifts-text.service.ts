import { Injectable } from "@nestjs/common"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import type { Setup, Shift, SwapFinding } from "./shifts.contracts"
import { dayLabel, shiftLine, weekLabel } from "./policies/labels.policy"

/** The weekday keys, Monday first. */
const WEEKDAYS: ReadonlyArray<number> = [0, 1, 2, 3, 4, 5, 6]

@Injectable()
/** The words of the shifts capability: Office lines, messages to people and the labels they carry, in Vietnamese. */
export class ShiftsTextService {
    constructor(@InjectMessageCatalog() private readonly catalog: MessageCatalog) {}

    /** One catalog line in Vietnamese. */
    text(key: string, params: Record<string, string | number> = {}): string {
        return this.catalog.get(key, params, "vi")
    }

    private names(): ReadonlyArray<string> {
        return WEEKDAYS.map((day) => this.text(`shifts.weekday.${day}`))
    }

    /** "Thursday 08/10". */
    day(date: string): string {
        return dayLabel(date, this.names())
    }

    /** "05/10 - 11/10" for the week that starts on a Monday. */
    week(monday: string): string {
        return weekLabel(monday, this.names())
    }

    /** One line of a schedule: the day, the hours and the position. */
    line(setup: Pick<Setup, "positions">, shift: Shift): string {
        return shiftLine(setup, shift, this.names())
    }

    /** A day, or a range of days when the two differ. */
    range(from: string, to: string): string {
        return from === to ? this.day(from) : this.text("shifts.rangeDash", { from: this.day(from), to: this.day(to) })
    }

    /** The findings of a rule check as sentences. */
    findings(list: ReadonlyArray<SwapFinding>): Array<string> {
        return list.map((item) => this.text(`shifts.finding.${item.code}`, { ...item.params }))
    }
}
