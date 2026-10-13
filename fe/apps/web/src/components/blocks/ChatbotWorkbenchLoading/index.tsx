"use client"

import { useTranslations } from "next-intl"
import { ChatbotWorkbenchLoadingBase } from "./component"

/** The Chatbot workbench while its data is unresolved: the frame's own tree with the real terms and label. */
export const ChatbotWorkbenchLoading = () => {
    const t = useTranslations("workbenchChatbot")
    return (
        <ChatbotWorkbenchLoadingBase
            props={{
                figureTerms: [
                    { id: "today", term: t("metricToday") },
                    { id: "waiting", term: t("metricWaiting") },
                    { id: "response", term: t("metricResponse") },
                    { id: "leads", term: t("metricLeads") },
                ],
                tabs: [{ id: "inbox", label: t("title") }],
            }}
        />
    )
}
