import type { ListSource } from "@nivo-lite/agent-sdk/block"
import { entityPort, type EntityApi } from "@nivo-lite/agent-sdk/entity/port"
import { definePort, type PortDefinition } from "@nivo-lite/agent-sdk/port"
import { hiringCandidateEntity } from "./entities/candidate.entity"
import { hiringJobEntity } from "./entities/job.entity"
import type { CandidateRow, JobRow } from "./hiring-records"

/*
 * The data of the Hiring module is the engine's: every row is a record of a declared type read and written through its entity port.
 */

/** The port of the jobs (`blocks-core.hiring.job`). */
export const JOBS: PortDefinition<EntityApi> = entityPort(hiringJobEntity)

/** The port of the candidates (`blocks-core.hiring.candidate`). */
export const CANDIDATES: PortDefinition<EntityApi> = entityPort(hiringCandidateEntity)

/** The port the jobs list runs on: the engine turns a list shape and a query into one query over `blocks-core.hiring.job`. */
export const hiringJobsList: PortDefinition<ListSource<JobRow>> = definePort<ListSource<JobRow>>("hiring.jobs-list")

/** The port the candidates list runs on: one query over `blocks-core.hiring.candidate`. */
export const hiringCandidatesList: PortDefinition<ListSource<CandidateRow>> =
    definePort<ListSource<CandidateRow>>("hiring.candidates-list")
