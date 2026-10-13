"use client"

import { useTranslations } from "next-intl"
import { isManager, useMember } from "@/hooks/member"
import { useState } from "react"
import { ApiQuickStartBase } from "./component"
import type { QuickStartExample } from "./component"

/** Props for the connected quick start: the public API address, the site origin and /api/v1. */
interface ApiQuickStartProps {
    readonly base: string
}

const AUTH = '-H "Authorization: Bearer nvk_..."'
const JSON_TYPE = '-H "Content-Type: application/json"'

/** The connected quick start: builds the copy-ready examples for the public API and remembers which one was copied last. */
export const ApiQuickStart = (props: ApiQuickStartProps) => {
    const t = useTranslations("developers")
    const member = useMember()
    const [copiedId, setCopiedId] = useState<string>()
    const copy = (id: string, code: string) => {
        navigator.clipboard.writeText(code).then(
            () => setCopiedId(id),
            () => setCopiedId(undefined),
        )
    }
    const sample = (id: string, title: string, code: string, note?: string): QuickStartExample => ({
        id,
        title,
        note,
        code,
        copyLabel: copiedId === id ? t("copied") : t("copy"),
    })
    const lead = {
        name: t("sampleName"),
        phone: "0901234567",
        email: "a@example.com",
        need: t("sampleNeed"),
        channel: "Zalo",
        stage: "new",
    }
    const message = { lead_id: "<uuid>", text: t("sampleText") }
    const knowledge = {
        title: t("sampleTitle"),
        content: t("sampleContent"),
        topic: t("sampleTopic"),
        visibility: "internal",
    }
    const post = (path: string, body: object) =>
        `curl -X POST ${props.base}/${path} \\\n  ${AUTH} \\\n  ${JSON_TYPE} \\\n  -d '${JSON.stringify(body)}'`
    if (!isManager(member)) return null
    return (
        <ApiQuickStartBase
            props={{
                title: t("guideTitle"),
                intro: t("guideIntro", { base: props.base }),
                examples: [
                    sample("header", t("header"), "Authorization: Bearer nvk_..."),
                    sample("leadsPost", t("leadsPost"), post("leads", lead), t("leadsPostNote")),
                    sample("messagesPost", t("messagesPost"), post("messages", message), t("messagesPostNote")),
                    sample("knowledgePost", t("knowledgePost"), post("knowledge", knowledge), t("knowledgePostNote")),
                    sample(
                        "leadsGet",
                        t("leadsGet"),
                        `curl "${props.base}/leads?status=new" \\\n  ${AUTH}`,
                        t("pullNote"),
                    ),
                    sample(
                        "eventsGet",
                        t("eventsGet"),
                        `curl "${props.base}/events?since=2026-10-01T00:00:00Z" \\\n  ${AUTH}`,
                    ),
                ],
                n8n: {
                    title: t("n8nTitle"),
                    steps: t("n8nSteps"),
                    examples: [
                        sample("n8nUrl", t("n8nUrl"), `${props.base}/leads`),
                        sample("n8nBody", t("n8nBody"), JSON.stringify(lead, null, 2)),
                    ],
                },
            }}
            on={{ copy }}
        />
    )
}
