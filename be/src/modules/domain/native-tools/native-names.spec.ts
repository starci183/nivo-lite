import { TOOL } from "@nivo-lite/agent-sdk/names"
import { mock } from "@starci/jest-preset"
import { INSTALLED } from "@modules/domain/installed-plugins"
import {
    EINVOICE_MANIFEST,
    NIVO_TOOL_PREFIX,
    ROLE_FAMILY_MANIFESTS,
    SEPAY_MANIFEST,
    addressOf,
    duplicateNamesOf,
    effectManifestsOf,
    toolNameOf,
    withEffectTools,
    withoutShadowed,
} from "@modules/domain/tools"
import type { NativeToolFamily, ToolManifest } from "@modules/domain/tools"
import { TeamChatNativeService } from "@modules/domain/team-chat"
import { DOMAIN_MANIFEST } from "@modules/domain/domain-tools/domain-tools.service"
import { CALENDAR_MANIFEST } from "@modules/domain/calendar-tools"
import { FACEBOOK_MANIFEST, INSTAGRAM_MANIFEST, TIKTOK_MANIFEST, YOUTUBE_MANIFEST } from "@modules/domain/social-tools"
import { MEDIA_MANIFEST } from "@modules/domain/media-tools"
import { BANK_MANIFEST } from "./bank-native.service"
import { BRAIN_MANIFEST } from "./brain-native.service"
import { CONNECTION_MANIFEST } from "./connection-status-native.service"
import { CONTACT_TOOLS_MANIFEST } from "@modules/domain/contact-tools"
import { DRIVE_MANIFEST } from "./drive-native.service"
import { FILE_MANIFEST } from "./file-native.service"
import { LEDGER_MANIFEST } from "./ledger-native.service"
import { MAIL_MANIFEST } from "./mail-native.service"
import { MAIL_SEND_MANIFEST } from "./mail-send-native.service"
import { NIVO_CONTEXT_CONNECTOR } from "./nivo-native.service"
import { PASSAGE_MANIFEST } from "./passage-native.service"
import { RECORD_MANIFEST } from "./record-native.service"
import { pluginToolManifestsOf } from "./plugin-tools-native.service"

/** The context reads' connector, as `NivoNativeService` builds it. */
const CONTEXT_MANIFEST: ToolManifest = {
    key: NIVO_CONTEXT_CONNECTOR,
    namespace: NIVO_TOOL_PREFIX,
    name: "NIVO",
    contractVersion: "nivo-native@1",
    tools: [...pluginToolManifestsOf(INSTALLED)],
}

const adapterOf = (manifest: ToolManifest): NativeToolFamily => ({ manifest, invoke: () => Promise.resolve({}) })

/** The natives every app hands the gateway (`NATIVE_TOOL_ADAPTERS` and the gateway's own SePay and e-invoice), by their manifests. */
const COMMON: ReadonlyArray<ToolManifest> = [
    SEPAY_MANIFEST,
    EINVOICE_MANIFEST,
    BRAIN_MANIFEST,
    PASSAGE_MANIFEST,
    DRIVE_MANIFEST,
    CONNECTION_MANIFEST,
    SEPAY_MANIFEST,
    BANK_MANIFEST,
    LEDGER_MANIFEST,
    MAIL_MANIFEST,
    MAIL_SEND_MANIFEST,
    CONTEXT_MANIFEST,
    CONTACT_TOOLS_MANIFEST,
    DOMAIN_MANIFEST,
    MEDIA_MANIFEST,
    RECORD_MANIFEST,
    FILE_MANIFEST,
    CALENDAR_MANIFEST,
    FACEBOOK_MANIFEST,
    INSTAGRAM_MANIFEST,
    YOUTUBE_MANIFEST,
    TIKTOK_MANIFEST,
]

/** The api app adds the chat and the team chat natives. */
const apiManifests = (): ReadonlyArray<ToolManifest> => [
    ...COMMON,
    new TeamChatNativeService(
        mock<ConstructorParameters<typeof TeamChatNativeService>[0]>(),
        mock<ConstructorParameters<typeof TeamChatNativeService>[1]>(),
    ).manifest,
]

/** The full names a set of natives serves once NIVO's effect tools are joined, as the gateway module composes them. */
const composed = (natives: ReadonlyArray<ToolManifest>): ReadonlyArray<ToolManifest> => {
    const effects = effectManifestsOf(INSTALLED.nodeInstall().effects).map((manifest) => adapterOf(manifest))
    return withEffectTools(withoutShadowed(natives.map((manifest) => adapterOf(manifest))), effects).map(
        (adapter) => adapter.manifest,
    )
}

const namesOf = (manifests: ReadonlyArray<ToolManifest>): ReadonlyArray<string> =>
    manifests.flatMap((manifest) => manifest.tools.map((spec) => toolNameOf(manifest, spec.name)))

const ALL_TOOL_IDS: ReadonlySet<string> = new Set(Object.values(TOOL))

describe("the names of NIVO's native tools and effect tools", () => {
    it("the api app's natives with the effect tools hold no full name twice (the mcp app holds no native)", () => {
        expect(duplicateNamesOf(composed(apiManifests()))).toEqual([])
    })

    it("declares a capability role only in the families the static readiness reads (a module's readiness is a fact of the build)", () => {
        const playing = composed(apiManifests()).filter((manifest) => manifest.tools.some((spec) => spec.role !== undefined))
        expect(new Set(playing.map((manifest) => manifest.key))).toEqual(
            new Set(ROLE_FAMILY_MANIFESTS.map((manifest) => manifest.key)),
        )
    })

    it("names every native and effect tool at the tool level, as a full name the gateway reads", () => {
        const names = namesOf(composed(apiManifests()))
        expect(names.length).toBeGreaterThan(0)
        expect(names.filter((name) => !name.startsWith(`${NIVO_TOOL_PREFIX}.`) || addressOf(name) === null)).toEqual([])
    })

    it("serves under each native and effect name an id the vocabulary declares", () => {
        expect(namesOf(composed(apiManifests())).filter((name) => !ALL_TOOL_IDS.has(name))).toEqual([])
    })

    it("joins an effect domain to the native connector of the same key, and keeps every other domain a connector of its own", () => {
        const keys = composed(apiManifests()).map((manifest) => manifest.key)
        expect(new Set(keys).size).toBe(keys.length)
    })
})
