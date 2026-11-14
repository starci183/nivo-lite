import { defineAction, type ActionDefinition, type ActionResult } from "@nivo-lite/agent-sdk/block"
import type { EngineResult } from "@nivo-lite/agent-sdk/entity/port"
import { z } from "zod"
import { MAX_ID, MAX_LINE } from "../../../bounds"
import { VIDEO_BRAND_KIT_KEY } from "../../../entities/video/brand-kit.entity"
import { VIDEO_BRIEF_MAX } from "../../../entities/video/project.entity"
import {
    VIDEO_ASPECTS,
    VIDEO_GOALS,
    VIDEO_MAX_SECONDS,
    VIDEO_MIN_SECONDS,
    normaliseColor,
    targetSecondsOf,
} from "../../../rules/video/spec"
import { VIDEO_MANAGE } from "../constants"
import { BRAND, PROJECTS } from "../ports"

/** The reads a project write refreshes. */
const PROJECT_READS = ["blocks-core.video.api.project.list", "blocks-core.video.api.project.get"] as const

/** The id the host sends with every action; an action on no record gets an empty one. */
const hostRecordId = z.string().max(MAX_ID).optional()

/** Why a Video action refused, each with a message of the module under `refusal_<reason>`. */
type VideoRefusal = "project_missing" | "color_invalid"

const refusedWith = (reason: VideoRefusal): ActionResult => ({
    ok: false,
    reason: "refused",
    message: { key: `refusal_${reason}` },
})

/** The answer to a write another writer got to first: the person reloads and tries again. */
const CONFLICT: ActionResult = { ok: false, reason: "conflict", message: { key: "refusal_conflict" } }

/** The answer of a write: the record's id, or the conflict. */
const writtenOf = (written: EngineResult): ActionResult => {
    if (written.ok) return { ok: true, data: { id: written.row.id } }
    return written.reason === "missing" ? refusedWith("project_missing") : CONFLICT
}

const saveProjectInput = z.object({
    id: hostRecordId,
    title: z.string().trim().min(1).max(MAX_LINE),
    goal: z.enum(VIDEO_GOALS),
    aspect: z.enum(VIDEO_ASPECTS),
    targetSeconds: z.number().min(VIDEO_MIN_SECONDS).max(VIDEO_MAX_SECONDS),
    brief: z.string().max(VIDEO_BRIEF_MAX).optional(),
})

/**
 * `blocks-core.video.project-save`: opens a project, or changes the one the id names (its title, goal, shape, length and brief). The script is
 * the video agent's: a new project starts with none, and the agent writes it when a workflow calls it.
 */
export const saveProjectAction: ActionDefinition = defineAction({
    id: "blocks-core.video.project-save",
    permission: VIDEO_MANAGE,
    label: { key: "action_save_project" },
    input: saveProjectInput,
    ports: { projects: PROJECTS },
    transactional: true,
    run: async ({ projects }, input) => {
        const values = {
            title: input.title,
            goal: input.goal,
            aspect: input.aspect,
            targetSeconds: targetSecondsOf(input.targetSeconds),
            brief: (input.brief ?? "").trim(),
        }
        if (input.id === undefined || input.id === "")
            return writtenOf(await projects.insert({ ...values, status: "draft", script: { scenes: [] } }))
        const current = await projects.get(input.id)
        if (current === null) return refusedWith("project_missing")
        return writtenOf(await projects.update(current.id, current.version, values))
    },
    refreshes: PROJECT_READS,
    optimistic: false,
})

/** `blocks-core.video.project-archive`: puts a project away (it leaves the list); a project already put away stays so. */
export const archiveProjectAction: ActionDefinition = defineAction({
    id: "blocks-core.video.project-archive",
    permission: VIDEO_MANAGE,
    label: { key: "action_archive_project" },
    input: z.object({ id: z.string().min(1).max(MAX_ID) }),
    ports: { projects: PROJECTS },
    transactional: true,
    run: async ({ projects }, { id }) => {
        const current = await projects.get(id)
        if (current === null) return refusedWith("project_missing")
        return writtenOf(await projects.update(current.id, current.version, { status: "archived" }))
    },
    refreshes: PROJECT_READS,
    optimistic: false,
})

const saveBrandInput = z.object({
    id: hostRecordId,
    shopName: z.string().trim().max(MAX_LINE),
    primaryColor: z.string().max(MAX_LINE).optional(),
    secondaryColor: z.string().max(MAX_LINE).optional(),
    voiceId: z.string().trim().max(MAX_ID).optional(),
})

/** A colour the owner typed: none when blank, else `#rrggbb` or `undefined` for a colour that is none. */
const colorOf = (typed: string | undefined): string | null | undefined => {
    if (typed === undefined || typed.trim() === "") return null
    return normaliseColor(typed) ?? undefined
}

/**
 * `blocks-core.video.brand-kit-save`: saves the brand kit of the workspace (the one record): the name shown in the videos, its two colours (`#rgb` or
 * `#rrggbb`) and the voice of the speech account. A colour that is none is refused.
 */
export const saveBrandAction: ActionDefinition = defineAction({
    id: "blocks-core.video.brand-kit-save",
    permission: VIDEO_MANAGE,
    label: { key: "action_save_brand" },
    input: saveBrandInput,
    ports: { brand: BRAND },
    transactional: true,
    run: async ({ brand }, input) => {
        const primaryColor = colorOf(input.primaryColor)
        const secondaryColor = colorOf(input.secondaryColor)
        if (primaryColor === undefined || secondaryColor === undefined) return refusedWith("color_invalid")
        const voiceId = input.voiceId === undefined || input.voiceId === "" ? null : input.voiceId
        const written = await brand.upsert("brand_key", {
            key: VIDEO_BRAND_KIT_KEY,
            shopName: input.shopName,
            primaryColor,
            secondaryColor,
            voiceId,
        })
        return written.ok ? { ok: true, data: { id: written.row.id } } : CONFLICT
    },
    refreshes: ["blocks-core.video.api.brand-kit.get"],
    optimistic: false,
})
