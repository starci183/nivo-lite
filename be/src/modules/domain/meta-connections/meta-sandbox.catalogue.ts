import type {
    SandboxCase,
    SandboxCatalogue,
    SandboxInboundCase,
    SandboxInboundContext,
    SandboxInput,
    SandboxInputField,
    SandboxState,
    SandboxWebhookEvent,
} from "@modules/domain/provider-sandbox"

/** The provider key of the Meta (Facebook Page and Instagram) catalogue: `connections.provider` names it so. */
export const META_SANDBOX_PROVIDER = "meta"

/** The Facebook Page id the sandbox account's Messenger events name (`entry[].id`, `recipient.id`). */
export const META_SANDBOX_PAGE_ID = "sandbox-page"

/** The Instagram account id the sandbox account's Instagram events name. */
export const META_SANDBOX_IG_ID = "sandbox-ig"

/** Meta's reply window: 24 hours after the person's last message (the standard messaging window). */
export const META_REPLY_WINDOW_MS = 24 * 3_600_000

/** How far before the send's moment the stamp of a line outside the window lies: 25 hours, one hour outside the reply window. */
export const META_SANDBOX_STALE_AGE_MS = 25 * 3_600_000

/**
 * The state name of what Meta remembers of each person's last line: key = the person's id (`psid`), value = epoch milliseconds (a number)
 * of the timestamp of the person's latest message. Written by every inbound case, read back by `metaLastLineAt` (the customer-send
 * sandbox refuses when the line is more than 24 hours older than the send).
 */
export const META_SANDBOX_LAST_LINE_STATE = "last-line"

/**
 * The webhook route of the sandbox door of the Meta app webhook for one account. Meta's real webhook is app-wide (one URL for every
 * Page, signed with the app secret) and names no connection, so a sandbox account has its own door beside it that names the account and
 * proves it with the sandbox key; a live account is never accepted there.
 */
const metaRoute = (connectionId: string): string => `api/connections/meta/webhook/${connectionId}`

/** The Meta timestamp (epoch ms) of the person's last line as the account's state holds it, or null when the person never wrote. */
export const metaLastLineAt = async (state: Pick<SandboxState, "read">, personId: string): Promise<number | null> => {
    const kept = await state.read(META_SANDBOX_LAST_LINE_STATE, personId)
    return typeof kept === "number" ? kept : null
}

/** The input naming the person (every case): the Page-scoped id of a Messenger user, or the Instagram-scoped id. */
const PERSON_FIELD: SandboxInputField = { name: "psid", label: "ID của khách / Id of the person", kind: "text", example: "7700110022" }

/** The input holding the line the person writes. */
const TEXT_FIELD: SandboxInputField = {
    name: "text",
    label: "Nội dung tin / Message text",
    kind: "text",
    example: "Chao shop, cho minh hoi gia bo hoa hong do nhe",
}

/** What one inbound case does: the platform, the kind of message and how long before the send the stamp lies. */
interface MetaMessagePlan {
    readonly platform: "facebook" | "instagram"
    readonly kind: "text" | "photo"
    readonly ageMs: number
}

/** The id of the account's next message: `sbx-mid-000001` for the first inbound send of the account. */
const messageIdOf = (seq: number): string => `sbx-mid-${String(seq + 1).padStart(6, "0")}`

/**
 * One Meta inbound case: a person's message becomes ONE webhook body as Meta posts it (`object` `page` or `instagram`, one `entry` with one
 * `messaging` item whose `message` has a `mid` and a `text`, or an image attachment and no text), stamped `at - age` and kept in the
 * account's state as the person's last line.
 */
const caseOf = (plan: MetaMessagePlan, inputs: ReadonlyArray<SandboxInputField>): SandboxInboundCase => ({
    trigger: `${plan.platform}.message.received`,
    path: metaRoute,
    inputs,
    eventsOf: async (input: SandboxInput, context: SandboxInboundContext): Promise<ReadonlyArray<SandboxWebhookEvent>> => {
        const sentAt = context.at.getTime() - plan.ageMs
        const personId = typeof input.psid === "string" ? input.psid : String(input.psid ?? "")
        const surfaceId = plan.platform === "facebook" ? META_SANDBOX_PAGE_ID : META_SANDBOX_IG_ID
        const mid = messageIdOf(context.state.seq)
        await context.state.write(META_SANDBOX_LAST_LINE_STATE, personId, sentAt)
        const message =
            plan.kind === "photo"
                ? { mid, attachments: [{ type: "image", payload: { url: `https://sandbox.invalid/${mid}.jpg` } }] }
                : { mid, text: typeof input.text === "string" ? input.text : "" }
        return [
            {
                body: {
                    object: plan.platform === "facebook" ? "page" : "instagram",
                    entry: [
                        {
                            id: surfaceId,
                            time: Math.floor(sentAt / 1000),
                            messaging: [{ sender: { id: personId }, recipient: { id: surfaceId }, timestamp: sentAt, message }],
                        },
                    ],
                },
            },
        ]
    },
})

/**
 * Meta's hardcoded sandbox cases (owner ruling R62): six inbound TRANSFORMATIONS of `{ psid, text }` / `{ psid }` into the body Meta posts
 * (Messenger `object: "page"`, Instagram `object: "instagram"`, `entry[].messaging[]`) to the sandbox door of the app webhook,
 * `api/connections/meta/webhook/<connectionId>`: a text line, a picture with no text, and a text line stamped 25 hours before the send
 * (outside the 24-hour reply window, a later customer send is refused). State kept: `last-line`. The customer SEND answers from
 * `meta-sandbox-send.catalogue.ts` (META-SEND-1..3).
 */
export const META_SANDBOX_CATALOGUE: SandboxCatalogue = {
    provider: META_SANDBOX_PROVIDER,
    cases: [
        {
            id: "META-1",
            label: "Messenger: a person writes the Page a text line, stamped at the send",
            inbound: caseOf({ platform: "facebook", kind: "text", ageMs: 0 }, [PERSON_FIELD, TEXT_FIELD]),
        },
        {
            id: "META-2",
            label: "Messenger: a person sends the Page a picture and no text, stamped at the send",
            inbound: caseOf({ platform: "facebook", kind: "photo", ageMs: 0 }, [PERSON_FIELD]),
        },
        {
            id: "META-3",
            label: "Messenger: a person's text line stamped 25 hours before the send: outside the 24-hour reply window, a later customer send is refused",
            inbound: caseOf({ platform: "facebook", kind: "text", ageMs: META_SANDBOX_STALE_AGE_MS }, [PERSON_FIELD, TEXT_FIELD]),
        },
        {
            id: "META-4",
            label: "Instagram: a person writes the account a text line, stamped at the send",
            inbound: caseOf({ platform: "instagram", kind: "text", ageMs: 0 }, [PERSON_FIELD, TEXT_FIELD]),
        },
        {
            id: "META-5",
            label: "Instagram: a person sends the account a picture and no text, stamped at the send",
            inbound: caseOf({ platform: "instagram", kind: "photo", ageMs: 0 }, [PERSON_FIELD]),
        },
        {
            id: "META-6",
            label: "Instagram: a person's text line stamped 25 hours before the send: outside the 24-hour reply window, a later customer send is refused",
            inbound: caseOf({ platform: "instagram", kind: "text", ageMs: META_SANDBOX_STALE_AGE_MS }, [PERSON_FIELD, TEXT_FIELD]),
        },
    ] satisfies ReadonlyArray<SandboxCase>,
}
