import { escapeShell } from "@shared/Util";
import { getCommandTransformer } from "./CommandTransformer";

const FOOBAR_EXECUTABLE = "foobar2000.exe";
export function createCommand(filename: string, args: string): string {
    let escFilename: string = escapeShell(filename);
    let escArgs: string = escapeLinuxArgs(args);

    const isSoundtrack = filename
        .toLocaleLowerCase()
        .endsWith(FOOBAR_EXECUTABLE);
    if (isSoundtrack) return createSoundtrackCommand(escFilename, args);

    const transformer = getCommandTransformer(filename);
    return transformer.transform(escFilename, escArgs);
}

function createSoundtrackCommand(escFilename: string, args: string) {
    const foobarDirectory = escFilename.slice(0, -FOOBAR_EXECUTABLE.length);
    return `cd ${foobarDirectory} && flatpak run com.retro_exo.wine-9-0 ${FOOBAR_EXECUTABLE} ${args}`;
}

/**
 * Escape arguments that will be used in a Linux shell (command line)
 * ( According to this: https://stackoverflow.com/questions/15783701/which-characters-need-to-be-escaped-when-using-bash )
 */
function escapeLinuxArgs(str: string): string {
    return str.replace(/((?![a-zA-Z0-9,._+:@%-]).)/g, "\\$&"); // $& means the whole matched string
}
