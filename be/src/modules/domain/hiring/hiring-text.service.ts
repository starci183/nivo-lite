import { Injectable } from "@nestjs/common"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import type { TextOf } from "./hiring.contracts"
import { vnClockText } from "./policies/vn-time.policy"

@Injectable()
/** The words of the hiring capability: Office lines, messages to candidates, timeline lines and labels, in Vietnamese. */
export class HiringTextService {
    constructor(@InjectMessageCatalog() private readonly catalog: MessageCatalog) {}

    /** One catalog line in Vietnamese. */
    text(key: string, params: Record<string, string | number> = {}): string {
        return this.catalog.get(key, params, "vi")
    }

    /** The lookup the pure policies use. */
    readonly textOf: TextOf = (key, params) => this.text(key, { ...params })

    /** A number of dong with thousands separators. */
    amount(value: number): string {
        return Math.round(value).toLocaleString("vi-VN")
    }

    /** A moment as the weekday, the time and the date on the Vietnam clock. */
    when(instant: Date | string): string {
        const clock = vnClockText(new Date(instant))
        return this.text("hiring.when", {
            weekday: this.text(`hiring.weekday.${clock.weekday}`),
            time: clock.time,
            date: clock.date,
        })
    }
}
