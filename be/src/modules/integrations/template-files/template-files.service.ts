import { readdir, readFile } from "node:fs/promises"
import { join } from "node:path"
import { Injectable } from "@nestjs/common"
import { TemplateFilesError, TemplateFilesErrorCode } from "./errors/template-files.error"
import type { TemplateFiles } from "./template-files.contracts"
import { InjectTemplateFilesOptions } from "./template-files.decorators"
import type { TemplateFilesOptions } from "./template-files.options"

const JSON_SUFFIX = ".json"
const META_SUFFIX = ".meta.json"
const AUTOMATIONS_FOLDER = "automation-templates"
const N8N_FOLDER = "n8n-templates"

@Injectable()
/** Reads the definition files of the automation catalogue from the resources folder. */
export class TemplateFilesService implements TemplateFiles {
    constructor(@InjectTemplateFilesOptions() private readonly options: TemplateFilesOptions) {}

    /** The catalogue definitions: every json of `automation-templates` and every `.meta.json` of `n8n-templates`, each folder in file-name order. */
    async readDefinitions(): Promise<ReadonlyArray<unknown>> {
        const executed = await this.readFolder(AUTOMATIONS_FOLDER, (name) => name.endsWith(JSON_SUFFIX))
        const shared = await this.readFolder(N8N_FOLDER, (name) => name.endsWith(META_SUFFIX))
        return [...executed, ...shared]
    }

    private async readFolder(folder: string, wanted: (name: string) => boolean): Promise<ReadonlyArray<unknown>> {
        const names = (await readdir(join(this.options.root, folder))).filter(wanted).sort()
        return Promise.all(names.map((name) => this.readJson(join(this.options.root, folder, name), name)))
    }

    private async readJson(path: string, name: string): Promise<unknown> {
        const text = await readFile(path, "utf8")
        try {
            return JSON.parse(text)
        } catch (cause) {
            throw new TemplateFilesError({ code: TemplateFilesErrorCode.FileInvalid, params: { file: name }, cause })
        }
    }
}
