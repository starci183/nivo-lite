import type { ActionResult } from "@nivo-lite/agent-sdk/block"

/** Why a platform action refused, each with a message of the module. */
export type PlatformRefusal = "missing" | "not_parked" | "forbidden" | "not_waiting" | "decide_refused"

/**
 * The words of each refusal, in both languages. They are inline, not catalogue keys: a platform action runs from the workbench of any
 * module (the desk of Sales, of Chatbot), where a key is looked up under that module's namespace, which does not hold the platform's.
 */
export const PLATFORM_REFUSAL_WORDS: Readonly<Record<PlatformRefusal, { readonly vi: string; readonly en: string }>> = {
    missing: { vi: "Kh\u00f4ng t\u00ecm th\u1ea5y l\u01b0\u1ee3t ch\u1ea1y n\u00e0y", en: "This run was not found" },
    not_parked: { vi: "L\u01b0\u1ee3t ch\u1ea1y n\u00e0y kh\u00f4ng \u0111ang d\u1eebng, kh\u00f4ng c\u00f3 g\u00ec \u0111\u1ec3 ch\u1ea1y l\u1ea1i", en: "This run is not stopped, there is nothing to run again" },
    forbidden: {
        vi: "Ch\u1ec9 ch\u1ee7, qu\u1ea3n l\u00fd ho\u1eb7c ng\u01b0\u1eddi qu\u1ea3n l\u00fd module n\u00e0y m\u1edbi ch\u1ea1y l\u1ea1i \u0111\u01b0\u1ee3c",
        en: "Only an owner, a manager or someone who manages this module can run it again",
    },
    not_waiting: { vi: "Vi\u1ec7c n\u00e0y kh\u00f4ng c\u00f2n ch\u1edd \u1edf \u0111\u00e2y", en: "This is no longer waiting here" },
    decide_refused: { vi: "Kh\u00f4ng ghi nh\u1eadn \u0111\u01b0\u1ee3c quy\u1ebft \u0111\u1ecbnh", en: "The decision could not be recorded" },
}

/** A domain refusal as data, with its words inline. */
export const refusedWith = (reason: PlatformRefusal): ActionResult => ({
    ok: false,
    reason: "refused",
    message: PLATFORM_REFUSAL_WORDS[reason],
})
