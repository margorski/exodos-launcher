import { IAppCommandsMappingData, ICommandMapping } from "./interfaces";
import { escapeShell } from "../Util";

const FOOBAR_EXECUTABLE = "foobar2000.exe";

export const getAllowedExtensionsForMappings = (
    mappings: IAppCommandsMappingData
) => {
    const extensions = mappings.commandsMapping.reduce(
        (extensions, mapping) => {
            extensions.push(...mapping.extensions);
            return extensions;
        },
        [] as string[]
    );

    return new Set(extensions.map((e) => e.toLowerCase()));
};

export const createCommand = (
    filename: string,
    args: string,
    mappings: IAppCommandsMappingData
) => {
    let escFilename: string = escapeShell(filename);
    let escArgs: string = escapeLinuxArgs(args);

    const isSoundtrack = filename
        .toLocaleLowerCase()
        .endsWith(FOOBAR_EXECUTABLE);
    if (isSoundtrack) return createSoundtrackCommand(escFilename, args);

    const { command, includeArgs, includeFilename } = getCommandMapping(
        filename,
        mappings
    );
    return `${command} ${includeFilename ? escFilename : ""} ${
        includeArgs ? escArgs : ""
    }`.trim();
};

const createSoundtrackCommand = (escFilename: string, args: string) => {
    const foobarDirectory = escFilename.slice(0, -FOOBAR_EXECUTABLE.length);
    return `cd ${foobarDirectory} && flatpak run com.retro_exo.wine ${FOOBAR_EXECUTABLE} ${args}`;
};

const getCommandMapping = (
    filename: string,
    mappings: IAppCommandsMappingData
) => {
    const extension = filename.split(".").pop();
    if (!extension) throw "Invalid file without extension.";

    const transformer = mappings.commandsMapping.find((t) =>
        t.extensions
            .map((e) => e.toLowerCase())
            .includes(extension.toLowerCase())
    );
    return transformer ?? mappings.defaultMapping;
};

/**
 * Escape arguments that will be used in a Linux shell (command line)
 * ( According to this: https://stackoverflow.com/questions/15783701/which-characters-need-to-be-escaped-when-using-bash )
 */
function escapeLinuxArgs(str: string): string {
    return str.replace(/((?![a-zA-Z0-9,._+:@%-]).)/g, "\\$&"); // $& means the whole matched string
}
