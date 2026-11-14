import { PROVIDER, TOOL } from "@nivo-lite/agent-sdk/names"
import { defineTemplateNode, type TemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { webrenewText } from "../../modules/webrenew/copy"
import { WEBRENEW_REGISTRARS } from "../../modules/webrenew/webrenew.accounts"
import { type RenewOutput, renewOutputSchema } from "./renew.node"
import { textOf } from "./webrenew.calls"
import { RENEWAL_ID, refused, registrarAnswered } from "./webrenew.examples"

/** The renewal as the registrar step left it, and the domain it renewed (the registrar finds the order by the name and the end date before). */
type RenewRecheckInput = {
    readonly renewal: RenewOutput
    readonly domain: string | null
}

const ID = "webrenew.renew-recheck"

const params: z.ZodType<Record<string, never>> = z.object({})
const input: z.ZodType<RenewRecheckInput> = z.object({ renewal: renewOutputSchema, domain: z.string().min(1).max(253).nullable() })

/** The registrar's two outcomes of a renewal it took. */
const takenOf = (value: unknown): "renewed" | "pending" | null =>
    value === "renewed" || value === "pending" ? value : null

const RENEWED: RenewOutput = {
    renewalId: RENEWAL_ID,
    serviceCode: "EXAMPLE-TM",
    termMonths: 12,
    outcome: "renewed",
    reason: null,
    reference: "INET-ORD-7781",
    provider: "inet",
    newExpiresOn: "2027-12-12",
    expiresBefore: "2026-12-12",
}
const PENDING: RenewOutput = { ...RENEWED, outcome: "pending", newExpiresOn: null }

const CALL = { name: "example.vn", expiresBefore: "2026-12-12", reference: "INET-ORD-7781" }

/** The registrar's answer of the order-state read. */
const readAnswer = (outcome: "renewed" | "pending", expiresOn: string) =>
    registrarAnswered(PROVIDER.inet, {
        provider: "inet",
        name: "example.vn",
        reference: "INET-ORD-7781",
        outcome,
        expiresBefore: "2026-12-12",
        expiresOn,
    })

/**
 * `webrenew.renew-recheck` (Re-check a pending renewal, R57 / E-R57): ONE registrar READ, no AI, the body of the graph's `settle` loop.
 * A renewal the registrar took but did not prove (`pending`) is read again with `nivo.tool.domain.renewal.get` `{ name, expiresBefore,
 * reference }` (the proof is the registrar's own end date, as the renewal's): `renewed` returns the renewal as renewed with the new end
 * date; still `pending` returns it unchanged (the loop waits and reads again, up to its bound). Any other renewal (renewed, refused, not
 * renewable) is returned as it is with no call, so the loop ends in its first round. A read the registrar refuses proves nothing: the
 * renewal stays as it was. An answer that names no known outcome stops the run (the engine reports it). Mode `auto`: it only reads.
 */
export const webrenewRenewRecheckNode: TemplateNode<typeof input, typeof renewOutputSchema, typeof params> = defineTemplateNode({
    id: ID,
    title: webrenewText("node.renewRecheck.title"),
    description: {
        vi: "Đọc lại đơn gia hạn nhà đăng ký đã nhận nhưng chưa đổi ngày hết hạn, để biết đã gia hạn xong chưa.",
        en: "Reads again a renewal the registrar took whose end date did not move yet, to learn whether it is renewed.",
    },
    tools: [TOOL.domainRenewalGet],
    mode: "auto",
    accounts: [...WEBRENEW_REGISTRARS],
    params,
    input,
    output: renewOutputSchema,
    run: async (given, context) => {
        const { renewal, domain } = given
        if (renewal.outcome !== "pending" || domain === null || renewal.expiresBefore === null) return renewal
        const read = await context.tools.call(TOOL.domainRenewalGet, {
            name: domain,
            expiresBefore: renewal.expiresBefore,
            reference: renewal.reference,
        })
        if (!read.ok) return renewal
        const outcome = takenOf(read.value["outcome"])
        const expiresOn = textOf(read.value, "expiresOn")
        if (outcome === null || (outcome === "renewed" && expiresOn === null))
            return context.fail({ kind: "cannot", why: "renewal_read_incomplete" }, read.value)
        return outcome === "renewed" ? { ...renewal, outcome, reason: null, newExpiresOn: expiresOn } : renewal
    },
    examples: [
        {
            name: "the registrar's end date moved since: the renewal is renewed with the new date",
            params: {},
            input: { renewal: PENDING, domain: "example.vn" },
            tools: [{ id: TOOL.domainRenewalGet, args: CALL, answer: readAnswer("renewed", "2027-12-12") }],
            output: RENEWED,
        },
        {
            name: "still not moved: the renewal stays pending (the loop reads again later)",
            params: {},
            input: { renewal: PENDING, domain: "example.vn" },
            tools: [{ id: TOOL.domainRenewalGet, args: CALL, answer: readAnswer("pending", "2026-12-12") }],
            output: PENDING,
        },
        {
            name: "a read the registrar refuses proves nothing: the renewal stays pending",
            params: {},
            input: { renewal: PENDING, domain: "example.vn" },
            tools: [{ id: TOOL.domainRenewalGet, args: CALL, answer: refused("not_found") }],
            output: PENDING,
        },
        {
            name: "a renewal that is not pending is returned as it is, with no call",
            params: {},
            input: { renewal: RENEWED, domain: "example.vn" },
            output: RENEWED,
        },
        {
            name: "an answer that names no known outcome stops the run",
            params: {},
            input: { renewal: PENDING, domain: "example.vn" },
            tools: [
                {
                    id: TOOL.domainRenewalGet,
                    args: CALL,
                    answer: registrarAnswered(PROVIDER.inet, { provider: "inet", name: "example.vn" }),
                },
            ],
            failure: { kind: "cannot", why: "renewal_read_incomplete" },
        },
    ],
})
