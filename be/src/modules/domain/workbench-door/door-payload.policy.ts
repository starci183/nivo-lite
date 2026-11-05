import { isRecord, parseJsonText } from "@modules/platform/primitives"
import type { PayloadParse } from "./workbench-door.contracts"

/** The longest payload text the door reads; the transport bounds it too, this keeps the domain safe on its own. */
export const PAYLOAD_MAX = 16_384

/**
 * The payload of a call as an object: the text must be within bounds, valid JSON and a JSON object (an array or a scalar is not what
 * a read or an action declares). The keys are checked later against the declaration by the read or action itself.
 */
export const parsePayload = (text: string): PayloadParse => {
    if (text.length > PAYLOAD_MAX) return { ok: false }
    const parsed = parseJsonText(text)
    if (!parsed.ok || !isRecord(parsed.value) || Array.isArray(parsed.value)) return { ok: false }
    return { ok: true, value: parsed.value }
}
