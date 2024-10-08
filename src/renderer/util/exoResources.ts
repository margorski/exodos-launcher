import { promises as fsPromises } from "fs";
import * as fs from "fs";
import * as path from "path";

// extensions need to have a dot and be lowercase
const ExodosResourcesTypeExtensions = {
    Documents: [".pdf", ".txt"],
    Scripts: [".command"],
};
const excludedFiles = [`exogui.command`];

// Update scripts
const updateScriptFiles = [
    `update.command`,
    `updateScummVm.command`,
    `update3x.command`,
].map((f) => `eXo/Update/${f}`);

// Label mapping
const labelMapping = {
    install_dependencies: "Install dependencies",
    update: "Update eXoDOS",
    updateScummVm: "Update eXoScummVM",
    update3x: "Update eXoWin3x",
};

export type ExodosResource = {
    label: string;
    filepath: string;
};

// HACK - null for separator
export type ExodosResources = {
    [type: string]: (ExodosResource | null)[];
};

export const loadExoResources = async () => {
    const result = {} as ExodosResources;
    const rootResourcesPath = window.External.config.fullExodosPath;

    try {
        const rootFiles = (await fsPromises.readdir(rootResourcesPath)).filter(
            (f) => !excludedFiles.includes(f.toLowerCase())
        );

        Object.entries(ExodosResourcesTypeExtensions).forEach((te) => {
            const [type, extensions] = te;
            result[type] = rootFiles
                .filter(withExtensonsFilter(extensions))
                .map(mapToExoResource);
        });

        const updateScripts = await getUpdateScriptsWithSeparator();
        result["Scripts"]?.push(...updateScripts);
    } catch (e) {
        console.error(`Error while loading eXo resources. Error: ${e}`);
    }
    return result;
};

const getUpdateScriptsWithSeparator = async () => {
    const result = [];
    const existingScripts = updateScriptFiles
        .filter((f) => {
            const filepath = path.join(
                window.External.config.fullExodosPath,
                f
            );
            return fs.existsSync(filepath);
        })
        .map(mapToExoResource);
    if (existingScripts.length > 0) {
        result.push(null);
        result.push(...existingScripts);
    }
    return result;
};

const withExtensonsFilter = (extensions: string[]) => (f: string) => {
    const extension = path.extname(f).toLowerCase();
    return extensions.includes(extension);
};
const mapToExoResource = (filepath: string): ExodosResource => {
    return {
        filepath,
        label: getLabel(filepath),
    };
};

const getLabel = (filename: string) => {
    const strippedFilename = filename.split(".")[0].split("/").pop();
    return (
        labelMapping[strippedFilename as keyof typeof labelMapping] ??
        strippedFilename ??
        "???"
    );
};
