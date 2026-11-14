import { TOOL } from "@nivo-lite/agent-sdk/names"
import { defineTemplateNode, type TemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { webrenewText } from "../../modules/webrenew/copy"
import { CRM_NIVOWEB, CRM_NIVOWEB_PROVIDER } from "../../crm/nivoweb/api.generated"
import {
    type DueService,
    type HeldService,
    ROUND_SERVICES_MAX,
    type TeamLocale,
    dueServiceSchema,
    heldServiceSchema,
    localeSchema,
} from "./renew-shapes"
import { DUE_TM, crmAnswered, truthsAnswer } from "./webrenew.examples"

/** The language the team reads. */
type DueInput = {
    readonly locale: TeamLocale
}

/** What the step answers: the services to remind today and the ones held, each with why. */
type DueOutput = {
    readonly due: ReadonlyArray<DueService>
    readonly held: ReadonlyArray<HeldService>
}

const ID = "webrenew.due"

/** What the agent may read: the expiring list, and the company's truths (the renewal rules, the support hours). Reads only. */
const READS = [CRM_NIVOWEB.get_services_expiring]

const params: z.ZodType<Record<string, never>> = z.object({})
const input: z.ZodType<DueInput> = z.object({ locale: localeSchema })
const output: z.ZodType<DueOutput> = z.object({
    due: z
        .array(dueServiceSchema)
        .max(ROUND_SERVICES_MAX)
        .describe("Every service the renewal rules say to remind today."),
    held: z
        .array(heldServiceSchema)
        .max(ROUND_SERVICES_MAX)
        .describe("Every service the rules would remind today that cannot be reminded now, with why."),
})

const GOAL =
    "Find the services to remind about their renewal today. First search the company's truths for the renewal rules: how many days " +
    "before the end the first notice goes, after how many days a notice repeats, when to stop and tell the team, and the support hours " +
    "(whether `now` in the input is a time to send; `today` is the shop's own calendar day). Then read the services that end soon, within the days those rules give, expired " +
    "ones included. Apply the rules to the FACTS of each row (daysLeft, lastReminderOn, reminderCount, openReminder, openRenewalId, " +
    "reachable, expirySource): the list gives no verdict. A row the rules say to remind today goes to `due`, copied as listed; a row " +
    "they would remind but that cannot be now goes to `held` with why; any other row is left out. When no truth gives the renewal " +
    "rules, or they are unclear, do not guess: say you are confused."

/** The renewal rules the worked example searches. */
const RULES = truthsAnswer([
    {
        id: "f-renew-1",
        text: "Nhac gia han lan dau 30 ngay truoc khi het han, nhac lai moi 3 ngay; sau 5 lan thi dung va bao doi.",
    },
    { id: "f-hours-1", text: "Gio ho tro: 8:00-17:30 thu Hai den thu Sau." },
])

/** One row of the expiring list as the CRM answers it. */
const row = (
    code: string,
    facts: Readonly<Record<string, string | number | boolean | null>>,
): Record<string, string | number | boolean | null> => ({
    code,
    customerCode: "KH-001",
    domain: "example.vn",
    serviceClass: "domain",
    provider: "manual",
    status: "active",
    statusText: null,
    startsOn: "2025-12-01",
    expiresOn: "2026-12-12",
    expirySource: "provider",
    daysLeft: 30,
    reachable: true,
    lastReminderOn: null,
    reminderCount: 0,
    openReminder: false,
    openRenewalId: null,
    ...facts,
})

const LISTED = {
    items: [
        row("EXAMPLE-TM", {}),
        row("SAMPLE-HOST", {
            customerCode: "KH-002",
            domain: "sample.vn",
            serviceClass: "hosting",
            daysLeft: 10,
            lastReminderOn: "2026-11-11",
            reminderCount: 2,
            openReminder: true,
        }),
        row("DEMO-SSL", {
            customerCode: "KH-003",
            domain: "demo.vn",
            serviceClass: "ssl",
            expirySource: "estimated",
            daysLeft: 20,
        }),
    ],
    nextCursor: null,
}

const HELD: ReadonlyArray<HeldService> = [
    { serviceCode: "SAMPLE-HOST", customerCode: "KH-002", why: "open_reminder" },
    { serviceCode: "DEMO-SSL", customerCode: "KH-003", why: "estimated" },
]

/** The run's instant of the example (its `run.day` is the date it is written with). */
const AT = "2026-11-12T01:00:00.000Z"

/**
 * `webrenew.due` (Find the services that end soon): the agent reads the company's renewal rules from the truths, lists the
 * services that end soon from the CRM, and applies the rules to the facts of each row. It answers the services to remind today
 * and the ones held, with why. No number of the rules is in code: the cadence, the stop and the hours are truths. The day is the
 * run's own day in the workspace's time zone (`run.day`) and its instant (`run.at`, for the support hours), both fixed across
 * re-runs. Writes nothing.
 */
export const webrenewDueNode: TemplateNode<typeof input, typeof output, typeof params> = defineTemplateNode({
    id: ID,
    title: webrenewText("node.due.title"),
    description: { vi: "T\u00ecm c\u00e1c d\u1ecbch v\u1ee5 s\u1eafp h\u1ebft h\u1ea1n, theo quy t\u1eafc nh\u1eafc gia h\u1ea1n c\u1ee7a c\u00f4ng ty, v\u00e0 ch\u1ecdn d\u1ecbch v\u1ee5 c\u1ea7n nh\u1eafc h\u00f4m nay, d\u1ecbch v\u1ee5 n\u00e0o t\u1ea1m gi\u1eef v\u00e0 v\u00ec sao.", en: "Finds the services ending soon, applies the company's renewal reminder rules, and says which to remind today and which to hold, with why." },
    tools: READS,
    mode: "auto",
    accounts: [CRM_NIVOWEB_PROVIDER],
    params,
    input,
    output,
    model: "claude-sonnet-5-5",
    requires: [CRM_NIVOWEB.get_services_expiring],
    run: (given, context) =>
        context.agent.run({
            goal: GOAL,
            input: { locale: given.locale, today: context.run.day, now: context.run.at },
            output,
            tools: READS,
            maxTurns: 6,
        }),
    examples: [
        {
            name: "reads the rules, lists the services, reminds the one at 30 days and holds one waiting and one estimated",
            params: {},
            input: { locale: "vi" },
            at: AT,
            agent: [
                {
                    answer: { due: [DUE_TM], held: HELD },
                    // the agent's own reads, in call order
                    calls: [
                        { id: TOOL.brainSearch, args: { query: "quy dinh gia han va gio ho tro" }, answer: RULES },
                        {
                            id: CRM_NIVOWEB.get_services_expiring,
                            args: { withinDays: 30, includeExpired: true, limit: ROUND_SERVICES_MAX },
                            answer: crmAnswered(LISTED),
                        },
                    ],
                },
            ],
            output: { due: [DUE_TM], held: HELD },
        },
    ],
})
