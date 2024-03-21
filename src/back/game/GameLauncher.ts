import { LogFunc, OpenDialogFunc, OpenExternalFunc } from "@back/types";
import { IAdditionalApplicationInfo, IGameInfo } from "@shared/game/interfaces";
import { ExecMapping } from "@shared/interfaces";
import {
    fixSlashes,
    getFilename,
    padStart,
    stringifyArray,
    escapeShell,
} from "@shared/Util";
import { ChildProcess, exec } from "child_process";
import { EventEmitter } from "events";
import * as path from "path";

export type LaunchAddAppOpts = LaunchBaseOpts & {
    addApp: IAdditionalApplicationInfo;
    native: boolean;
};

export type LaunchGameOpts = LaunchBaseOpts & {
    game: IGameInfo;
    addApps?: IAdditionalApplicationInfo[];
    native: boolean;
};

type LaunchBaseOpts = {
    fpPath: string;
    execMappings: ExecMapping[];
    log: LogFunc;
    openDialog: OpenDialogFunc;
    openExternal: OpenExternalFunc;
};

export namespace GameLauncher {
    const logSource = "Game Launcher";

    export function launchCommand(
        appPath: string,
        appArgs: string,
        log: LogFunc
    ): Promise<void> {
        const command = createCommand(appPath, appArgs);
        const proc = exec(command);
        logProcessOutput(proc, log);
        log({
            source: logSource,
            content: `Launch command (PID: ${proc.pid}) [ path: "${appPath}", arg: "${appArgs}", command: ${command} ]`,
        });
        return new Promise((resolve, reject) => {
            if (proc.killed) {
                resolve();
            } else {
                proc.once("exit", () => {
                    resolve();
                });
                proc.once("error", (error) => {
                    reject(error);
                });
            }
        });
    }

    export function launchAdditionalApplication(
        opts: LaunchAddAppOpts
    ): Promise<void> {
        // @FIXTHIS It is not possible to open dialog windows from the back process (all electron APIs are undefined).
        switch (opts.addApp.applicationPath) {
            case ":message:":
                return opts
                    .openDialog({
                        type: "info",
                        title: "About This Game",
                        message: opts.addApp.launchCommand,
                        buttons: ["Ok"],
                    })
                    .then();

            case ":extras:":
                const folderPath = fixSlashes(
                    path.join(
                        opts.fpPath,
                        path.posix.join("Extras", opts.addApp.launchCommand)
                    )
                );
                return opts
                    .openExternal(folderPath, { activate: true })
                    .catch((error) => {
                        if (error) {
                            opts.openDialog({
                                type: "error",
                                title: "Failed to Open Extras",
                                message:
                                    `${error.toString()}\n` +
                                    `Path: ${folderPath}`,
                                buttons: ["Ok"],
                            });
                        }
                    });

            default:
                const appPath: string = fixSlashes(
                    path.join(
                        opts.fpPath,
                        getApplicationPath(
                            opts.addApp.applicationPath,
                            opts.execMappings,
                            opts.native
                        )
                    )
                );
                const appArgs: string = opts.addApp.launchCommand;
                return launchCommand(appPath, appArgs, opts.log);
        }
    }

    /**
     * Launch a game
     * @param game Game to launch
     */
    export async function launchGame(opts: LaunchGameOpts): Promise<void> {
        // Abort if placeholder (placeholders are not "actual" games)
        if (opts.game.placeholder) {
            return;
        }
        // Run all provided additional applications with "AutoRunBefore" enabled
        if (opts.addApps) {
            const addAppOpts: Omit<LaunchAddAppOpts, "addApp"> = {
                fpPath: opts.fpPath,
                native: opts.native,
                execMappings: opts.execMappings,
                log: opts.log,
                openDialog: opts.openDialog,
                openExternal: opts.openExternal,
            };
            for (let addApp of opts.addApps) {
                if (addApp.autoRunBefore) {
                    const promise = launchAdditionalApplication({
                        ...addAppOpts,
                        addApp,
                    });
                    if (addApp.waitForExit) {
                        await promise;
                    }
                }
            }
        }
        // Launch game
        let proc: ChildProcess;
        const gamePath: string = fixSlashes(
            path.join(
                opts.fpPath,
                getApplicationPath(
                    opts.game.applicationPath,
                    opts.execMappings,
                    opts.native
                )
            )
        );
        const gameArgs: string = opts.game.launchCommand;

        let command: string;
        try {
            command = createCommand(gamePath, gameArgs);
        } catch (e) {
            opts.log({
                source: logSource,
                content: `Launch Game "${opts.game.title}" failed. Error: ${e}`,
            });
            return;
        }

        proc = exec(command);
        logProcessOutput(proc, opts.log);
        opts.log({
            source: logSource,
            content:
                `Launch Game "${opts.game.title}" (PID: ${proc.pid}) [\n` +
                `    applicationPath: "${opts.game.applicationPath}",\n` +
                `    launchCommand:   "${opts.game.launchCommand}",\n` +
                `    command:         "${command}" ]`,
        });
    }

    /**
     * Launch a game
     * @param game Game to launch
     */
    export async function launchGameSetup(opts: LaunchGameOpts): Promise<void> {
        // Launch game
        let proc: ChildProcess;
        const setupPath = opts.game.applicationPath.replace(
            getFilename(opts.game.applicationPath),
            "install.command"
        );
        const gamePath: string = fixSlashes(
            path.join(
                opts.fpPath,
                getApplicationPath(setupPath, opts.execMappings, opts.native)
            )
        );

        const gameArgs: string = opts.game.launchCommand;
        const command: string = createCommand(gamePath, gameArgs);

        proc = exec(command);
        logProcessOutput(proc, opts.log);
        opts.log({
            source: logSource,
            content:
                `Launch Game Setup "${opts.game.title}" (PID: ${proc.pid}) [\n` +
                `    applicationPath: "${opts.game.applicationPath}",\n` +
                `    launchCommand:   "${opts.game.launchCommand}",\n` +
                `    command:         "${command}" ]`,
        });
    }

    /**
     * The paths provided in the Game/AdditionalApplication XMLs are only accurate
     * on Windows. So we replace them with other hard-coded paths here.
     */
    function getApplicationPath(
        filePath: string,
        execMappings: ExecMapping[],
        native: boolean
    ): string {
        const platform = process.platform;

        // Bat files won't work on Wine, force a .sh file on non-Windows platforms instead. Sh File may not exist.
        if (platform !== "win32" && filePath.endsWith(".bat")) {
            return filePath.substring(0, filePath.length - 4) + ".command";
        }

        // Skip mapping if on Windows or Native application was not requested
        if (platform !== "win32" && native) {
            for (let i = 0; i < execMappings.length; i++) {
                const mapping = execMappings[i];
                if (mapping.win32 === filePath) {
                    switch (platform) {
                        case "linux":
                            return mapping.linux || mapping.win32;
                        case "darwin":
                            return mapping.darwin || mapping.win32;
                        default:
                            return filePath;
                    }
                }
            }
        }

        // No Native exec found, return Windows/XML application path
        return filePath;
    }

    function createCommand(filename: string, args: string): string {
        let escFilename: string = escapeShell(filename);
        let escArgs: string = escapeLinuxArgs(args);

        const isCommandFile = filename.toLocaleLowerCase().endsWith(".command");
        const commandWithArguments = `${escFilename} ${escArgs}`;
        if (isCommandFile) return commandWithArguments;
        else return `xdg-open ${commandWithArguments}`;
    }

    function logProcessOutput(proc: ChildProcess, log: LogFunc): void {
        // Log for debugging purposes
        // (might be a bad idea to fill the console with junk?)
        const logStuff = (event: string, args: any[]): void => {
            log({
                source: logSource,
                content: `${event} (PID: ${padStart(
                    proc.pid ?? -1,
                    5
                )}) ${stringifyArray(args, stringifyArrayOpts)}`,
            });
        };
        doStuffs(
            proc,
            [/* 'close', */ "disconnect", "error", "exit", "message"],
            logStuff
        );
        if (proc.stdout) {
            proc.stdout.on("data", (data) => {
                logStuff("stdout", [data.toString("utf8")]);
            });
        }
        if (proc.stderr) {
            proc.stderr.on("data", (data) => {
                logStuff("stderr", [data.toString("utf8")]);
            });
        }
    }
}

const stringifyArrayOpts = {
    trimStrings: true,
};

function doStuffs(
    emitter: EventEmitter,
    events: string[],
    callback: (event: string, args: any[]) => void
): void {
    for (let i = 0; i < events.length; i++) {
        const e: string = events[i];
        emitter.on(e, (...args: any[]) => {
            callback(e, args);
        });
    }
}

/**
 * Escape a string that will be used in a Windows shell (command line)
 * ( According to this: http://www.robvanderwoude.com/escapechars.php )
 */
function escapeWin(str: string): string {
    return splitQuotes(str).reduce(
        (acc, val, i) =>
            acc + (i % 2 === 0 ? val.replace(/[\^&<>|]/g, "^$&") : `"${val}"`),
        ""
    );
}

/**
 * Split a string to separate the characters wrapped in quotes from all other.
 * Example: '-a -b="123" "example.com"' => ['-a -b=', '123', ' ', 'example.com']
 * @param str String to split.
 * @returns Split of the argument string.
 *          Items with odd indices are wrapped in quotes.
 *          Items with even indices are NOT wrapped in quotes.
 */
function splitQuotes(str: string): string[] {
    // Search for all pairs of quotes and split the string accordingly
    const splits: string[] = [];
    let start = 0;
    while (true) {
        const begin = str.indexOf('"', start);
        if (begin >= 0) {
            const end = str.indexOf('"', begin + 1);
            if (end >= 0) {
                splits.push(str.substring(start, begin));
                splits.push(str.substring(begin + 1, end));
                start = end + 1;
            } else {
                break;
            }
        } else {
            break;
        }
    }
    // Push remaining characters
    if (start < str.length) {
        splits.push(str.substring(start, str.length));
    }
    return splits;
}

/**
 * Escape arguments that will be used in a Linux shell (command line)
 * ( According to this: https://stackoverflow.com/questions/15783701/which-characters-need-to-be-escaped-when-using-bash )
 */
function escapeLinuxArgs(str: string): string {
    return str.replace(/((?![a-zA-Z0-9,._+:@%-]).)/g, "\\$&"); // $& means the whole matched string
}

type UnityOutputResponse = {
    text: string;
    fn: (proc: ChildProcess, openDialog: OpenDialogFunc) => void;
};

const unityOutputResponses: UnityOutputResponse[] = [
    {
        text: "Failed to set registry keys!\r\n" + "Retry? (Y/n): ",
        fn(proc, openDialog) {
            openDialog({
                type: "warning",
                title: "Start Unity - Registry Key Warning",
                message: "Failed to set registry keys!\n" + "Retry?",
                buttons: ["Yes", "No"],
                defaultId: 0,
                cancelId: 1,
            }).then((response) => {
                if (!proc.stdin) {
                    throw new Error(
                        'Failed to signal to Unity starter. Can not access its "standard in".'
                    );
                }
                if (response === 0) {
                    proc.stdin.write("Y");
                } else {
                    proc.stdin.write("n");
                }
            });
        },
    },
    {
        text:
            "Invalid parameters!\r\n" +
            "Correct usage: startUnity [2.x|5.x] URL\r\n" +
            "If you need to undo registry changes made by this script, run unityRestoreRegistry.bat. \r\n" +
            "Press any key to continue . . . ",
        fn(proc, openDialog) {
            openDialog({
                type: "warning",
                title: "Start Unity - Invalid Parameters",
                message:
                    "Invalid parameters!\n" +
                    "Correct usage: startUnity [2.x|5.x] URL\n" +
                    "If you need to undo registry changes made by this script, run unityRestoreRegistry.bat.",
                buttons: ["Ok"],
                defaultId: 0,
                cancelId: 0,
            });
        },
    },
    {
        text:
            "You must close the Basilisk browser to continue.\r\n" +
            "If you have already closed Basilisk, please wait a moment...\r\n",
        fn(proc, openDialog) {
            openDialog({
                type: "info",
                title: "Start Unity - Browser Already Open",
                message:
                    "You must close the Basilisk browser to continue.\n" +
                    "If you have already closed Basilisk, please wait a moment...",
                buttons: ["Ok", "Cancel"],
                defaultId: 0,
                cancelId: 1,
            }).then((response) => {
                if (response === 1) {
                    proc.kill();
                }
            });
        },
    },
];
