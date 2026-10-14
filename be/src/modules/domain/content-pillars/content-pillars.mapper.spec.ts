import type { ContentPillarDraft } from "./content-pillars.contracts"
import { ContentPillarDraftSelectionMapper, toContentPillar } from "./content-pillars.mapper"
import type { ContentPillarRow } from "./persistence/content-pillars.rows"

const row: ContentPillarRow = {
    id: "pillar-1",
    workspace_id: "ws-1",
    name: "Tea",
    description: "Daily cups",
    weight: 3,
    sort: 1,
    active: true,
}

describe("toContentPillar", () => {
    it("maps a stored theme onto the public shape", () => {
        expect(toContentPillar(row)).toEqual({
            id: "pillar-1",
            workspaceId: "ws-1",
            name: "Tea",
            description: "Daily cups",
            weight: 3,
            sort: 1,
            active: true,
        })
    })
})

describe("ContentPillarDraftSelectionMapper", () => {
    it("keeps a string id and drops an omitted one", () => {
        const withId: ContentPillarDraft = {
            id: "pillar-1",
            name: "Tea",
            description: "Daily cups",
            weight: 3,
            active: true,
        }
        const omitted: ContentPillarDraft = { name: "Coffee", description: "", weight: 1, active: false }

        expect(new ContentPillarDraftSelectionMapper([withId, omitted]).rows).toEqual([
            { id: "pillar-1", name: "Tea", description: "Daily cups", weight: 3, active: true },
            { name: "Coffee", description: "", weight: 1, active: false },
        ])
    })
})
