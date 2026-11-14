import { valueLineOf } from "@modules/domain/brain-facts"
import { isRecord } from "@modules/platform/primitives"
import type { LessonCandidate, LessonCandidateStatus, LessonFactKey } from "./lesson-candidates.contracts"
import { lessonTextOk, lessonValueOf, namesCustomerData } from "./lesson-candidates.policy"
import type {
    LessonGroupDropReason,
    LessonGroupDropped,
    LessonGroupJudged,
    LessonGroupReading,
    MaybeLessonGroupsRead,
} from "./lesson-groups.contracts"

/**
 * The most answered stops one draft call reads: the newest of the place. The older ones are not read by this call; they stay
 * candidates and are read again by the next call of the place (the next answer kept there) while they are within the window, and
 * fall out of it by age. Never a loop over the rest.
 */
export const LESSON_ITEMS_MAX = 10

/**
 * The pinned version of the grouped draft call (its system prompt and the shape of its answer), named in every log of the call so a
 * later change of the prompt can be told apart: bump it with any change to `lessonGroupsSystemOf`, `lessonGroupsPrompt` or the answer.
 */
export const LESSON_GROUPS_PROMPT_VERSION = "lesson-groups@1"

/** The fewest free answers a question card stands on: one answer contradicts nothing. */
export const CONTRADICTION_MIN = 2

/** The longest label (subject, attribute) kept. */
const LABEL_MAX = 120

/** The longest topic kept. */
const TOPIC_MAX = 160

/** The longest drafted value kept. */
const VALUE_MAX = 500

/** The longest unit kept. */
const UNIT_MAX = 40

/** A day as the answer writes it. */
const DATE = /^\d{4}-\d{2}-\d{2}$/u

/** The states of the place's candidates a call is shown: free ones, ones the founder turned down, ones on an open card. */
const SHOWN: ReadonlySet<LessonCandidateStatus> = new Set(["candidate", "declined", "proposing", "proposed"])

/** How an item's state is shown to the model. */
const STATE_LINE: Readonly<Record<LessonCandidateStatus, string>> = {
    candidate: "new",
    proposing: "already on a card waiting for the owner",
    proposed: "already on a card waiting for the owner",
    declined: "the owner turned a truth from it down before",
    learned: "already learned",
}

/**
 * The items one draft call reads, oldest first: the place's candidates in the states a call is shown, the newest `LESSON_ITEMS_MAX`
 * of them. The 1-based position of an item in this list is its number in the prompt and in the answer.
 */
export const lessonItemsOf = (recent: ReadonlyArray<LessonCandidate>): ReadonlyArray<LessonCandidate> =>
    recent
        .filter((one) => SHOWN.has(one.status))
        .toSorted((left, right) => right.answeredAt.localeCompare(left.answeredAt))
        .slice(0, LESSON_ITEMS_MAX)
        .toReversed()

/** How many items of a call are free (status candidate): the count the call is worth making on. */
export const freeCountOf = (items: ReadonlyArray<LessonCandidate>): number =>
    items.filter((one) => one.status === "candidate").length

/**
 * The standing instructions of the grouped draft call: the model reads which answers ask the same thing and whether the founder's
 * answers agree, and drafts a truth for each agreeing group from the founder's own words. `statedEnd` is an example of a stated end
 * in the founder's language.
 */
export const lessonGroupsSystemOf = (statedEnd: string): string =>
    [
        "An AI assistant of a shop stopped at the same step and asked the shop owner; below are its numbered questions and the owner's answers.",
        "First GROUP the items: items whose questions ask the same thing form one group. An item that asks what no other item asks is left out.",
        'For each group say whether the owner\'s answers in it agree (they decide the same: "agree") or contradict each other (they decide differently: "contradict").',
        "For a group that agrees, write ONE truth (a shop rule) that would have let the assistant handle these cases alone next time, and name in rests_on the item numbers of the answers it is drawn from.",
        "value is copied EXACTLY as the owner wrote it in one of those answers (a span of the owner's own words, never rephrased): never add a condition, an amount, an exception or a step the owner did not say.",
        "A truth is about the SHOP's rule, never about one customer: no customer name, phone, order code or account number.",
        "Write only shop words: never a name of the system (a tool like nivo.…, a key with underscores, an id). unit only when value is a number.",
        "subject and attribute are short labels in the owner's language, built from the words of the questions (so a search finds it); topic is a short phrase (max 12 words) of what was asked.",
        "For a group that contradicts, give subject, attribute and topic, and lesson null.",
        "STATE tells where an item stands; group every item by what it asks, whatever its state.",
        'Reply with ONLY JSON: {"groups":[{"items":[number,...],"answers":"agree"|"contradict","subject":string,"attribute":string,"topic":string,',
        '"lesson":{"value":string,"unit":string|null,"valid_to":"YYYY-MM-DD"|null,"rests_on":[number,...]}|null}]}, or {"groups":[]}.',
        `valid_to only when the owner stated an end (e.g. '${statedEnd}'); else null.`,
    ].join("\n")

/** The user message of the grouped draft call: each item as a numbered block, oldest first (numbers from 1, as `lessonItemsOf` orders them). */
export const lessonGroupsPrompt = (items: ReadonlyArray<LessonCandidate>): string =>
    items
        .map(
            (item, index) =>
                `[${index + 1}] QUESTION: ${item.question}\nOWNER'S ANSWER: ${item.answer}\nTHEN THE STEP: ${item.thenDid}\nSTATE: ${STATE_LINE[item.status]}`,
        )
        .join("\n\n")

/** A trimmed text field cut to `max`, or null when it is no text or empty. */
const textOf = (json: Readonly<Record<string, unknown>>, name: string, max: number): string | null => {
    const value = json[name]
    return typeof value === "string" && value.trim() !== "" ? value.trim().slice(0, max) : null
}

/** The numbers of a list field, or null when the field is no list or names anything but a whole number. Duplicates fold. */
const numbersOf = (value: unknown): ReadonlyArray<number> | null => {
    if (!Array.isArray(value)) return null
    const numbers = value.filter((one): one is number => typeof one === "number" && Number.isInteger(one))
    return numbers.length === value.length ? [...new Set(numbers)] : null
}

/** One group of the answer as written: its fields, and the numbers it names. */
interface WrittenGroup {
    /** The group's fields. */
    readonly json: Readonly<Record<string, unknown>>
    /** The item numbers it names. */
    readonly numbers: ReadonlyArray<number>
}

/** A group of the answer read for its shape, or why it is dropped. */
type ShapedGroup =
    { readonly ok: true; readonly group: WrittenGroup } | { readonly ok: false; readonly dropped: LessonGroupDropped }

/** A dropped group. */
const droppedOf = (numbers: ReadonlyArray<number>, why: LessonGroupDropReason): LessonGroupDropped => ({ numbers, why })

/** A group of the answer read for its shape: an object naming a non-empty list of numbers, each the number of an item of the call. */
const shapedOf = (value: unknown, count: number): ShapedGroup => {
    if (!isRecord(value)) return { ok: false, dropped: droppedOf([], "malformed") }
    const numbers = numbersOf(value.items)
    if (numbers === null || numbers.length === 0) return { ok: false, dropped: droppedOf(numbers ?? [], "malformed") }
    if (numbers.some((at) => at < 1 || at > count)) return { ok: false, dropped: droppedOf(numbers, "unknown_item") }
    return { ok: true, group: { json: value, numbers } }
}

/** The labels a card names: the truth's key and the topic. */
interface GroupLabels {
    /** The truth's key. */
    readonly factKey: LessonFactKey
    /** A short phrase of what was asked. */
    readonly topic: string
}

/** A passed check. */
const passed = <Value>(value: Value): LessonGroupJudged<Value> => ({ ok: true, value })

/** A failed check. */
const failed = <Value>(why: LessonGroupDropReason): LessonGroupJudged<Value> => ({ ok: false, why })

/** The labels of a group (subject, attribute, topic), or why they cannot stand in a card. */
const labelsOf = (json: Readonly<Record<string, unknown>>): LessonGroupJudged<GroupLabels> => {
    const subject = textOf(json, "subject", LABEL_MAX)
    const attribute = textOf(json, "attribute", LABEL_MAX)
    const topic = textOf(json, "topic", TOPIC_MAX)
    if (subject === null || attribute === null || topic === null) return failed("malformed")
    if (![subject, attribute, topic].every((text) => lessonTextOk(text))) return failed("not_shop_words")
    if (namesCustomerData(`${subject} ${attribute}`)) return failed("customer_data")
    return passed({ factKey: { subjectLabel: subject, attributeLabel: attribute }, topic })
}

/** A text in one form for the verbatim check: one Unicode form, spaces folded, one case. Characters only, never words. */
const foldedOf = (text: string): string => text.normalize("NFC").replaceAll(/\s+/gu, " ").trim().toLocaleLowerCase()

/** Whether a drafted value (or its value + unit line, the store's one form) stands verbatim in one of the answers it rests on. */
const saidIn = (value: string, unit: string | null, answers: ReadonlyArray<LessonCandidate>): boolean => {
    const forms = [value, valueLineOf({ value, unit })].map((text) => foldedOf(text))
    return answers.some((one) => forms.some((form) => foldedOf(one.answer).includes(form)))
}

/** The answers a drafted truth rests on, checked: whole numbers, each an answer of its own group, at least `minimum` of them. */
const restsOnOf = (
    lesson: Readonly<Record<string, unknown>>,
    group: WrittenGroup,
    items: ReadonlyArray<LessonCandidate>,
    minimum: number,
): LessonGroupJudged<ReadonlyArray<LessonCandidate>> => {
    const rests = numbersOf(lesson.rests_on)
    if (rests === null) return failed("malformed")
    if (rests.some((at) => !group.numbers.includes(at))) return failed("rests_outside_group")
    if (rests.length < minimum) return failed("too_few_answers")
    return passed(items.filter((_, index) => rests.includes(index + 1)))
}

/** The agreeing group's drafted truth, checked: it rests on enough answers of the group, its value said verbatim in one of them. */
const lessonOf = (
    group: WrittenGroup,
    members: ReadonlyArray<LessonCandidate>,
    items: ReadonlyArray<LessonCandidate>,
    minimum: number,
): LessonGroupJudged<LessonGroupReading> => {
    const labels = labelsOf(group.json)
    if (!labels.ok) return labels
    const lesson = group.json.lesson
    if (!isRecord(lesson)) return failed("no_lesson")
    const restsOn = restsOnOf(lesson, group, items, minimum)
    if (!restsOn.ok) return restsOn
    const drafted = textOf(lesson, "value", VALUE_MAX)
    if (drafted === null) return failed("malformed")
    if (!lessonTextOk(drafted)) return failed("not_shop_words")
    if (namesCustomerData(drafted)) return failed("customer_data")
    const unit = textOf(lesson, "unit", UNIT_MAX)
    if (!saidIn(drafted, unit, restsOn.value)) return failed("value_not_said")
    const { value, unit: apart } = lessonValueOf({ value: drafted, unit })
    const validTo = typeof lesson.valid_to === "string" && DATE.test(lesson.valid_to) ? lesson.valid_to : null
    return passed({
        kind: "lesson",
        items: members,
        restsOn: restsOn.value,
        ...labels.value,
        value,
        unit: apart,
        validTo,
    })
}

/** A contradicting group, checked: it stands on at least two free answers, and its labels can stand in a card. */
const contradictionOf = (
    group: WrittenGroup,
    free: ReadonlyArray<LessonCandidate>,
): LessonGroupJudged<LessonGroupReading> => {
    if (free.length < CONTRADICTION_MIN) return failed("too_few_answers")
    const labels = labelsOf(group.json)
    return labels.ok ? passed({ kind: "contradiction", items: free, ...labels.value }) : labels
}

/** What one group that passed the shape and the one-group-per-item checks comes to. */
const readingOf = (
    group: WrittenGroup,
    items: ReadonlyArray<LessonCandidate>,
    minimum: number,
): LessonGroupJudged<LessonGroupReading> => {
    const members = items.filter((_, index) => group.numbers.includes(index + 1))
    // The founder decides the open card first: nothing of this group moves.
    if (members.some((one) => one.status === "proposing" || one.status === "proposed"))
        return passed({ kind: "waiting", items: members })
    const free = members.filter((one) => one.status === "candidate")
    if (group.json.answers === "contradict") return contradictionOf(group, free)
    if (group.json.answers !== "agree") return failed("malformed")
    // The same decision the founder turned down before: its new answers are declined, no card.
    if (free.length < members.length) return passed({ kind: "declined", items: free })
    return lessonOf(group, members, items, minimum)
}

/**
 * The groups of the grouped draft call's answer (a parsed JSON value), checked for integrity only: every number names an item of the
 * call (`items`, numbered from 1), no item stands in two groups (every group naming a shared item is dropped), a truth rests on at least
 * `minimum` answers of its own group and states its value verbatim in one of them, a contradiction stands on at least two free answers,
 * and the labels and the value carry no identifier of the engine and no customer's data. No code reads what a text means: which
 * answers ask the same thing and whether they agree is the model's reading. Null = not the expected JSON (a failed try).
 */
export const lessonGroupsOf = (
    json: unknown,
    items: ReadonlyArray<LessonCandidate>,
    minimum: number,
): MaybeLessonGroupsRead => {
    if (!isRecord(json) || !Array.isArray(json.groups)) return null
    const shaped = json.groups.map((value) => shapedOf(value, items.length))
    const uses = new Map<number, number>()
    shaped.forEach((one) => {
        if (one.ok) one.group.numbers.forEach((at) => uses.set(at, (uses.get(at) ?? 0) + 1))
    })
    const readings: Array<LessonGroupReading> = []
    const dropped: Array<LessonGroupDropped> = []
    shaped.forEach((one) => {
        if (!one.ok) {
            dropped.push(one.dropped)
            return
        }
        const { numbers } = one.group
        if (numbers.some((at) => (uses.get(at) ?? 0) > 1)) {
            dropped.push(droppedOf(numbers, "item_in_two_groups"))
            return
        }
        const reading = readingOf(one.group, items, minimum)
        if (reading.ok) readings.push(reading.value)
        else dropped.push(droppedOf(numbers, reading.why))
    })
    return { readings, dropped }
}
