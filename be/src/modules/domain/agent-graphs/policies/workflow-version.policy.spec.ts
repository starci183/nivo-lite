import { Test } from "@nestjs/testing"
import { latestTemplateVersion } from "@nivo-lite/agent-sdk/template"
import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import {
    acceptableTemplateVersion,
    closestTemplateVersion,
    newerTemplateVersion,
    nextVersionNumber,
    statusAllowed,
    workflowKeyOf,
} from "./workflow-version.policy"
import { withOlderVersion } from "@tests/fixtures/builders/workflow-catalogue.builder"
import { templateGraphOf, templateRequired } from "./workflow-view.policy"

const SUBJECT = Symbol("workflow-version.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    acceptableTemplateVersion,
                    closestTemplateVersion,
                    newerTemplateVersion,
                    nextVersionNumber,
                    statusAllowed,
                    workflowKeyOf,
                },
            },
        ],
    }).compile()
    return moduleRef.get<{
        acceptableTemplateVersion: typeof acceptableTemplateVersion
        closestTemplateVersion: typeof closestTemplateVersion
        newerTemplateVersion: typeof newerTemplateVersion
        nextVersionNumber: typeof nextVersionNumber
        statusAllowed: typeof statusAllowed
        workflowKeyOf: typeof workflowKeyOf
    }>(SUBJECT)
}

/** The consult template as a catalogue that still held the version before its newest: every shipped template holds one version. */
const CONSULT = withOlderVersion(templateRequired("sales.consult"))

/** The newest version of the template, and the one before it (one step apart). */
const NEWEST = latestTemplateVersion(CONSULT).version
const OLDER = NEWEST - 1

const graphOf = (version: number): GraphSpec => templateGraphOf(CONSULT, version)

describe("nextVersionNumber", () => {
    it("numbers the next version one above the newest, so history only grows", async () => {
        const subject = await build()

        expect(subject.nextVersionNumber(0, null)).toBe(1)
        expect(subject.nextVersionNumber(4, 4)).toBe(5)
    })

    it("refuses when someone published after the caller read the newest", async () => {
        const subject = await build()

        expect(subject.nextVersionNumber(5, 4)).toBeNull()
    })
})

describe("closestTemplateVersion", () => {
    it("finds the template version a graph is a copy of", async () => {
        const subject = await build()

        expect(subject.closestTemplateVersion(CONSULT, graphOf(NEWEST))).toBe(NEWEST)
        expect(subject.closestTemplateVersion(CONSULT, graphOf(OLDER))).toBe(OLDER)
    })

    it("takes the version with the fewest different steps for a changed graph", async () => {
        const subject = await build()
        const changed: GraphSpec = {
            ...graphOf(OLDER),
            nodes: graphOf(OLDER).nodes.map((node) =>
                node.key === "to-after-sale" ? { ...node, group: "shop" } : node,
            ),
        }

        expect(subject.closestTemplateVersion(CONSULT, changed)).toBe(OLDER)
    })
})

describe("template provenance", () => {
    it("offers the newest template version to a workflow that came from an older one, and nothing once it is current", async () => {
        const subject = await build()

        expect(subject.newerTemplateVersion(CONSULT, { templateId: "sales.consult", templateVersion: OLDER })).toBe(
            NEWEST,
        )
        expect(
            subject.newerTemplateVersion(CONSULT, { templateId: "sales.consult", templateVersion: NEWEST }),
        ).toBeNull()
        expect(subject.newerTemplateVersion(CONSULT, { templateId: "sales.after-sale", templateVersion: 1 })).toBeNull()
        expect(subject.newerTemplateVersion(CONSULT, null)).toBeNull()
    })

    it("accepts only a newer version of the template the workflow came from", async () => {
        const subject = await build()
        const link = { templateId: "sales.consult", templateVersion: 2 }

        expect(subject.acceptableTemplateVersion(link, "sales.consult", 4)).toBe(true)
        expect(subject.acceptableTemplateVersion(link, "sales.consult", 2)).toBe(false)
        expect(subject.acceptableTemplateVersion(link, "sales.after-sale", 3)).toBe(false)
        expect(subject.acceptableTemplateVersion(null, "sales.consult", 3)).toBe(false)
    })
})

describe("statusAllowed and workflowKeyOf", () => {
    it("lets a workflow go active only with a version to run, and keeps the primary one active", async () => {
        const subject = await build()

        expect(subject.statusAllowed({ primary: false, hasVersion: true }, "active")).toBe(true)
        expect(subject.statusAllowed({ primary: false, hasVersion: false }, "active")).toBe(false)
        expect(subject.statusAllowed({ primary: true, hasVersion: true }, "paused")).toBe(false)
        expect(subject.statusAllowed({ primary: false, hasVersion: true }, "draft")).toBe(true)
    })

    it("makes a plain key of a Vietnamese name (the template's own) and keeps it unique", async () => {
        const subject = await build()
        // The one sale graph is named "Bán hàng" now (it was "Tư vấn bán hàng" before the sale became one graph); the key drops the
        // marks the same way.
        const name = CONSULT.name.vi
        expect(name).toBe("Bán hàng")

        expect(subject.workflowKeyOf(name, new Set())).toBe("ban-hang")
        expect(subject.workflowKeyOf(name, new Set(["ban-hang"]))).toBe("ban-hang-2")
        expect(subject.workflowKeyOf("Tư vấn bán hàng", new Set())).toBe("tu-van-ban-hang")
        expect(subject.workflowKeyOf("!!!", new Set())).toBe("workflow")
    })
})
