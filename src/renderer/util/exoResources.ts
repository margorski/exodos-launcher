import { promises as fs } from "fs";
import * as path from "path";

// extensions need to have a dot and be lowercase
const ExodosResourcesTypeExtensions = {
    Documents: [".pdf", ".txt"],
    Scripts: [".command"],
};
const excludedFiles = [`exogui.command`, `exodreamm.command`];

export type ExodosResources = {
    [type in keyof typeof ExodosResourcesTypeExtensions]: string[];
};

export const loadExoResources = async () => {
    const result = {
        Documents: [],
        Scripts: [],
    } as ExodosResources;

    try {
        const files = (
            await fs.readdir(window.External.config.fullExodosPath)
        ).filter((f) => !excludedFiles.includes(f.toLowerCase()));
        Object.entries(ExodosResourcesTypeExtensions).forEach((te) => {
            const [type, extensions] = te;
            const test = files.filter((f) => {
                const extension = path.extname(f).toLowerCase();
                return extensions.includes(extension);
            });
            result[type as keyof typeof ExodosResourcesTypeExtensions] = test;
        });
    } catch (e) {
        console.error(`Error while loading eXo resources. Error: ${e}`);
    }
    return result;
};
