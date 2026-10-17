"use client"

import { useTranslations } from "next-intl"
import { GUIDES } from "@/hooks/connection-guides"
import { PROVIDERS, providerKey } from "@/hooks/connection-providers"
import { agentChoicesOf, EMPTY_GUIDE_CONTEXT, guideScreensOf, useCopyLabels } from "@/hooks/connection-wizard"
import { useZaloWizard, ZALO_STEPS } from "@/hooks/zalo-wizard"
import type { AgentOption } from "@/modules/types"
import { ZaloWizardBase } from "./component"

/** What the board hands the Zalo wizard. */
interface ZaloWizardProps {
    /** Continue this unfinished connection instead of creating a new one. */
    readonly resumeId?: string
    /** How the Zalo sign-in ended when the browser came back: ok, denied, failed or expired. */
    readonly returned?: string
    /** The workspace agents that can work through Zalo. */
    readonly agents: ReadonlyArray<AgentOption>
    /** `changed` is true when something was saved, so the list should refresh. */
    readonly onClose: (changed: boolean) => void
}

const SECRET_MASK = "••••••"

const textOf = (
    tw: ReturnType<typeof useTranslations<"connectionWizard">>,
    tc: ReturnType<typeof useTranslations<"connections">>,
) => ({
    back: tw("back"),
    next: tw("next"),
    close: tw("close"),
    done: tw("done"),
    skip: tw("skip"),
    openProvider: tw("openProvider", { brand: PROVIDERS.zalo_oa.brand }),
    fieldName: tc("fieldName"),
    fieldNameHint: tc("fieldNameHint"),
    fieldAppId: tc("fieldAppId"),
    fieldAppIdHint: tw("zaloAppHint"),
    fieldAppSecret: tc("fieldAppSecret"),
    createdLocked: tw("createdLocked"),
    saveOaSecret: tw("zaloSaveOaSecret"),
    oaSecretSaved: tw("zaloOaSecretSaved"),
    needSecret: tw("zaloNeedSecret"),
    authorizeBody: tw("zaloAuthorizeBody"),
    authorize: tw("zaloAuthorize"),
    reauthorize: tw("zaloReauthorize"),
    verifyIntro: tw("zaloVerifyIntro"),
    verifyWaiting: tw("zaloVerifyWaiting"),
})

/** Zalo OA in the shared wizard frame: name and app keys, set up the Zalo app, connect the OA, check, attach to the agents. */
export const ZaloWizard = (props: ZaloWizardProps) => {
    const tw = useTranslations("connectionWizard")
    const tc = useTranslations("connections")
    const copy = useCopyLabels()
    const wizard = useZaloWizard({
        resumeId: props.resumeId,
        returned: props.returned,
        agents: props.agents,
        onClose: props.onClose,
    })
    const def = PROVIDERS.zalo_oa
    const { conn, fields, firstEvent } = wizard
    const steps = GUIDES.zalo_oa ?? []
    const base = { provider: "zalo_oa", brand: def.brand, values: {}, drafts: {} } as const
    const followContext =
        conn === null
            ? EMPTY_GUIDE_CONTEXT
            : { ...EMPTY_GUIDE_CONTEXT, name: conn.name, webhookUrl: conn.webhookUrl, callbackUrl: conn.callbackUrl }
    const typed = fields.name.trim() !== "" && fields.appId.trim() !== "" && fields.appSecret.trim() !== ""
    const authorizedNote =
        conn !== null && conn.oaId !== "" ? tw("zaloAuthorizedOa", { id: conn.oaId }) : tw("zaloAuthorized")
    return (
        <ZaloWizardBase
            props={{
                title: tw("title", { provider: tc(providerKey("zalo_oa", "title")) }),
                stepLabel: tw("stepOf", { n: wizard.index + 1, total: ZALO_STEPS.length }),
                steps: [
                    tw("zaloStepApp"),
                    tw("zaloStepFollow"),
                    tw("zaloStepAuthorize"),
                    tw("stepVerify"),
                    tw("stepAgent"),
                ],
                index: wizard.index,
                step: wizard.step,
                waiting: wizard.isLoading ? tw("verifyWaiting") : null,
                providerHref: def.dashboard.live ?? "",
                appScreens: guideScreensOf({ ...base, steps: steps.slice(0, 1), ctx: EMPTY_GUIDE_CONTEXT }, tc, tw),
                followScreens: guideScreensOf(
                    { ...base, steps: steps.slice(1), ctx: followContext, values: { oaSecret: fields.oaSecret } },
                    tc,
                    tw,
                ),
                copy,
                fields: conn === null ? fields : { name: conn.name, appId: SECRET_MASK, appSecret: SECRET_MASK },
                isLocked: conn !== null,
                canCreate: conn !== null || typed,
                oaSecretSaved: conn !== null && conn.oaSecretSaved,
                canSaveSecret: wizard.canSaveSecret,
                hasOaSecretInput: fields.oaSecret.trim() !== "",
                isAuthorized: conn !== null && conn.authorized,
                authorizedNote,
                received:
                    firstEvent === null
                        ? null
                        : tw("zaloVerifyReceived", {
                              name: firstEvent.content === "" ? def.brand : firstEvent.content,
                          }),
                agentStep: {
                    title: tw("agentTitleChannel"),
                    notice: firstEvent === null ? tw("zaloSkipNote") : null,
                    agents: agentChoicesOf(props.agents, "zalo_oa", tw),
                    value: wizard.agentIds,
                    hint: tw("agentHint"),
                    none: tw("agentNone"),
                },
                note: wizard.note,
                isPending: wizard.isPending,
                text: textOf(tw, tc),
            }}
            on={wizard.on}
        />
    )
}
