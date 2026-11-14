"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { isManager, useMember } from "@/hooks/member"
import { claudeCodeSnippetOf, mcpJsonSnippetOf, useMcpEndpoint } from "@/hooks/developers"
import { ClaudeConnectCardBase, type ClaudeAddressView, type ClaudeSnippetView } from "./component"

/** The connected "Connect with Claude" card: the MCP address the API publishes and the snippets with the `<key>` placeholder (the key itself is shown once, after it is made). Owner and manager only (they make the MCP keys): staff see nothing of it and it asks the API for nothing. */
export const ClaudeConnectCard = () => {
    const t = useTranslations("developers")
    const isAllowed = isManager(useMember())
    const { state } = useMcpEndpoint()
    const [openIds, setOpenIds] = useState<ReadonlyArray<string>>(["address", "claudeCode"])
    const [copiedId, setCopiedId] = useState<string>()
    const copy = (id: string, code: string) => {
        navigator.clipboard.writeText(code).then(
            () => setCopiedId(id),
            () => setCopiedId(undefined),
        )
    }
    const copyLabelOf = (id: string) => (copiedId === id ? t("copied") : t("copy"))
    const address: ClaudeAddressView =
        state.kind === "url"
            ? { kind: "url", url: state.url }
            : { kind: "note", text: state.kind === "no-key" ? t("claudeAddressNoKey") : t("claudeAddressUnset") }
    const snippets: ClaudeSnippetView[] =
        state.kind === "url"
            ? [
                  {
                      id: "claudeCode",
                      title: t("claudeCodeTitle"),
                      note: t("claudeCodeNote"),
                      code: claudeCodeSnippetOf(state.url),
                      copyLabel: copyLabelOf("claudeCode"),
                  },
                  {
                      id: "mcpJson",
                      title: t("mcpJsonTitle"),
                      note: t("mcpJsonNote"),
                      code: mcpJsonSnippetOf(state.url),
                      copyLabel: copyLabelOf("mcpJson"),
                  },
              ]
            : []
    if (!isAllowed) return null
    return (
        <ClaudeConnectCardBase
            props={{
                title: t("claudeTitle"),
                intro: t("claudeIntro"),
                addressTitle: t("claudeAddress"),
                addressLabel: t("claudeAddress"),
                address,
                copyLabel: t("copy"),
                copiedLabel: t("copied"),
                snippets,
                connectors: { title: t("connectorsTitle"), text: t("connectorsNote") },
                dataNote: t("dataNote"),
                openIds,
            }}
            on={{
                copy,
                toggle: (id, isOpen) =>
                    setOpenIds((held) =>
                        isOpen ? [...held.filter((one) => one !== id), id] : held.filter((one) => one !== id),
                    ),
            }}
        />
    )
}
