"use client"

import { useTranslations } from "next-intl"
import { providerKey } from "@/hooks/connection-providers"
import { agentChoicesOf } from "@/hooks/connection-wizard"
import { META_STEPS, metaCheckLines, useMetaWizard } from "@/hooks/meta-wizard"
import type { AgentOption } from "@/modules/types"
import { MetaWizardBase } from "./component"

/** How the Meta test ended for the all-good sentence. */
type MetaTestVerdict = "ok" | "failed"

/** The all-good sentence is only for a check that passed; a failure keeps its own verdict. */
const metaTestVerdict = (ok: boolean): MetaTestVerdict => (ok ? "ok" : "failed")

/** What the board hands the Meta wizard. */
interface MetaWizardProps {
    /** Continue this unfinished connection instead of creating a new one. */
    readonly resumeId?: string | undefined
    /** How the Facebook login ended when the browser came back: ok, denied, failed, expired, nopages or unavailable. */
    readonly returned?: string | undefined
    /** The workspace agents that can work through Facebook and Instagram. */
    readonly agents: ReadonlyArray<AgentOption>
    /** `changed` is true when something was saved, so the list should refresh. */
    readonly onClose: (changed: boolean) => void
}

/** Facebook Pages and Instagram in the shared wizard frame: log in, pick the Page, attach the agents, then test what Meta really has. */
export const MetaWizard = (props: MetaWizardProps) => {
    const tw = useTranslations("connectionWizard")
    const tc = useTranslations("connections")
    const tm = useTranslations("metaWizard")
    const wizard = useMetaWizard({
        resumeId: props.resumeId,
        returned: props.returned,
        agents: props.agents,
        onClose: props.onClose,
    })
    const { conn, check, firstEvent } = wizard
    const steps = [tm("stepConnect"), tm("stepPick"), tm("stepAgent"), tm("stepTest")]
    const chosen =
        conn === null || conn.pageId === ""
            ? null
            : tm("pickChosen", {
                  page: conn.pageName,
                  ig: conn.igUsername === "" ? "" : ` · @${conn.igUsername}`,
              })
    return (
        <MetaWizardBase
            props={{
                title: tw("title", { provider: tc(providerKey("meta", "title")) }),
                stepLabel: tw("stepOf", { n: wizard.index + 1, total: META_STEPS.length }),
                steps,
                index: wizard.index,
                step: wizard.step,
                waiting: wizard.isLoading ? tm("working") : null,
                pages: (conn === null ? [] : conn.pages).map((page) => ({
                    value: page.id,
                    label: page.name,
                    description: page.igUsername === "" ? tm("pickNoIg") : tm("pickIg", { handle: page.igUsername }),
                })),
                pageId: wizard.pageId,
                chosen,
                agentStep: {
                    title: tw("agentTitleChannel"),
                    notice: null,
                    agents: agentChoicesOf(props.agents, "meta", tw),
                    value: wizard.agentIds,
                    hint: tw("agentHint"),
                    none: tw("agentNone"),
                },
                checked:
                    check === null
                        ? null
                        : {
                              page: tm("pageLine", { page: check.pageName }),
                              instagram:
                                  check.igUsername === "" ? tm("noIgLine") : tm("igLine", { handle: check.igUsername }),
                              verdict: metaTestVerdict(check.ok),
                          },
                lines: check === null ? [] : metaCheckLines(check, tm),
                received: firstEvent === null ? null : tm("testReceived", { name: firstEvent.content || "Meta" }),
                canRepair: check !== null && !check.ok && check.tokenOk,
                hasConnection: conn !== null,
                note: wizard.note,
                isPending: wizard.isPending,
                isChecking: wizard.isChecking,
                text: metaWizardText(tw, tm),
            }}
            on={wizard.on}
        />
    )
}

/** Resolves the labels for this form. */
const metaWizardText = (
    tw: ReturnType<typeof useTranslations<"connectionWizard">>,
    tm: ReturnType<typeof useTranslations<"metaWizard">>,
) => {
    return {
        back: tw("back"),
        next: tw("next"),
        close: tw("close"),
        done: tw("done"),
        connectBody: tm("connectBody"),
        connectScopes: tm("connectScopes"),
        devNote: tm("devNote"),
        connect: tm("connect"),
        reconnect: tm("reconnect"),
        pickBody: tm("pickBody"),
        pickNone: tm("pickNone"),
        pickSave: tm("pickSave"),
        pickSaved: tm("pickSaved"),
        testIntro: tm("testIntro"),
        testRun: tm("testRun"),
        testRepair: tm("testRepair"),
        testWorking: tm("testWorking"),
        testWaiting: tm("testWaiting"),
        testAllGood: tm("testAllGood"),
        testSkipNote: tm("testSkipNote"),
    }
}
