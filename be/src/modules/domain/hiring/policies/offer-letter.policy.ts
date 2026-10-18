import type { JobRecord, OfferTerms, PayUnit, TextOf } from "../hiring.contracts"
import { findFairnessViolations } from "./fairness.policy"

/** The most characters a generated greeting or closing may have. */
const PART_MAX = 700
const PART_MIN = 15

/** The catalog key of the name of each pay unit. */
const PAY_UNIT_KEYS: { readonly [unit in PayUnit]: `hiring.payUnit.${unit}` } = {
    month: "hiring.payUnit.month",
    hour: "hiring.payUnit.hour",
    shift: "hiring.payUnit.shift",
}

/** The catalog key of the name of a pay unit. */
const payUnitKey = (unit: PayUnit): `hiring.payUnit.${PayUnit}` => PAY_UNIT_KEYS[unit]

/** The pay of a job as one phrase, by the text catalog. */
export const payPhrase = (
    job: Pick<JobRecord, "payMinVnd" | "payMaxVnd" | "payUnit">,
    t: TextOf,
    format: (amount: number) => string,
): string => {
    const unit = t(payUnitKey(job.payUnit), {})
    const { payMinVnd: min, payMaxVnd: max } = job
    if (min !== null && max !== null && min > 0 && max > 0) {
        return min === max
            ? t("hiring.pay.exact", { amount: format(min), unit })
            : t("hiring.pay.range", { min: format(min), max: format(max), unit })
    }
    if (min !== null && min > 0) return t("hiring.pay.from", { amount: format(min), unit })
    if (max !== null && max > 0) return t("hiring.pay.upTo", { amount: format(max), unit })
    return t("hiring.pay.negotiable", {})
}

/** The terms of an offer as plain lines, always written by code from what the owner entered and never by a model. */
export const termsBlock = (job: JobRecord, terms: OfferTerms, offerDays: number, pay: string, t: TextOf): string =>
    [
        t("hiring.offer.termsHead", {}),
        t("hiring.offer.termPosition", {
            title: terms.title === "" ? job.title : terms.title,
            employment: t(`hiring.employment.${job.employmentType}`, {}),
        }),
        t("hiring.offer.termPay", { pay: terms.pay === "" ? pay : terms.pay }),
        terms.startDate === "" ? "" : t("hiring.offer.termStart", { date: terms.startDate }),
        terms.probation === "" ? "" : t("hiring.offer.termProbation", { probation: terms.probation }),
        job.location === "" ? "" : t("hiring.offer.termPlace", { place: job.location }),
        terms.note === "" ? "" : t("hiring.offer.termNote", { note: terms.note }),
        t("hiring.offer.termValid", { days: offerDays }),
    ]
        .filter((line) => line !== "")
        .join("\n")

/** What the offer letter is made of. */
export interface OfferLetterParts {
    /** The name of the candidate, for the template greeting. */
    readonly candidate: string
    /** The name of the business, for the template greeting and the signature. */
    readonly shop: string
    /** The position offered, for the template greeting. */
    readonly title: string
    /** The terms block written by code. */
    readonly terms: string
    /** The greeting the model wrote, or null to use the template. */
    readonly opening: string | null
    /** The closing the model wrote, or null to use the template. */
    readonly closing: string | null
}

/** The letter: the model greeting and closing when both came out clean, a fixed template otherwise, the terms always in the middle. */
export const composeOffer = (parts: OfferLetterParts, t: TextOf): string =>
    [
        parts.opening ?? t("hiring.offer.opening", { name: parts.candidate, shop: parts.shop, title: parts.title }),
        parts.terms,
        parts.closing ?? t("hiring.offer.closing", {}),
        t("hiring.offer.signoff", { shop: parts.shop }),
    ].join("\n\n")

/** A model paragraph for the letter when it is plain words: no markdown, no figures, nothing about protected traits, a sensible length; null otherwise. */
export const cleanLetterPart = (value: string): string | null => {
    const text = value
        .split(/(#+)/u)
        .map((part, index, parts) => {
            if (index % 2 === 1) return parts[index + 1]?.startsWith(" ") ? "" : part
            const plain = index > 0 && part.startsWith(" ") ? part.slice(1) : part
            return plain.replace(/\*\*?|__/gu, "")
        })
        .join("")
        .trim()
    const plain = text.length >= PART_MIN && text.length <= PART_MAX && !/\d/u.test(text)
    return plain && findFairnessViolations(text).length === 0 ? text : null
}
