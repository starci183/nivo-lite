import { Injectable } from "@nestjs/common"

@Injectable()
/**
 * The provider's integer order code of a payment link. payOS's documentation (https://payos.vn/docs/api/) states `orderCode` is an
 * integer, required, and names a refusal "order already exists"; it states no range and no uniqueness rule. The code is the time in
 * milliseconds (a safe integer well inside any 32 to 53 bit reading), made strictly increasing inside the process so two links made in the
 * same millisecond, or after the clock stepped back, never share a code. Another process could in theory make the same millisecond; the
 * provider then refuses "already exists" (a refusal that creates nothing), it never creates two links under one code.
 */
export class OrderCodesPolicy {
    private last = 0

    /** The next code, never equal to or below one already given by this process. */
    next(nowMs: number): number {
        this.last = Math.max(Math.floor(nowMs), this.last + 1)
        return this.last
    }
}
