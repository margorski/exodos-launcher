import { promises as fs } from "fs";
import * as path from "path";

// extensions need to have a dot and be lowercase
const ExodosResourcesTypeExtensions = {
    Documents: [".pdf", ".txt"],
    Scripts: [".command"],
};
const excludedFiles = [`exogui.command`];

// HACK - null for separator
export type ExodosResources = {
    [type: string]: (string | null)[];
};

export const loadExoResources = async () => {
    const result = {} as ExodosResources;

    try {
        const rootFiles = (
            await fs.readdir(window.External.config.fullExodosPath)
        ).filter((f) => !excludedFiles.includes(f.toLowerCase()));
        const updateFiles = await fs.readdir(
            path.join(window.External.config.fullExodosPath, "Update")
        );

        Object.entries(ExodosResourcesTypeExtensions).forEach((te) => {
            const [type, extensions] = te;
            result[type] = rootFiles.filter(withExtensonsFilter(extensions));
        });

        const updateScripts = updateFiles.filter(
            withExtensonsFilter(ExodosResourcesTypeExtensions["Scripts"])
        );
        if (updateScripts.length > 0) {
            result["Scripts"]?.push(null);
            result["Scripts"]?.push(...updateScripts);
        }
    } catch (e) {
        console.error(`Error while loading eXo resources. Error: ${e}`);
    }
    return result;
};

const withExtensonsFilter = (extensions: string[]) => (f: string) => {
    const extension = path.extname(f).toLowerCase();
    return extensions.includes(extension);
};
