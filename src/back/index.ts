import {
    AddLogData,
    BackIn,
    BackInit,
    BackInitArgs,
    BackOut,
    GetExecData,
    GetMainInitDataResponse,
    GetPlaylistResponse,
    GetRendererInitDataResponse,
    InitEventData,
    LaunchAddAppData,
    LaunchGameData,
    LocaleUpdateData,
    OpenDialogData,
    OpenDialogResponseData,
    OpenExternalData,
    OpenExternalResponseData,
    SetLocaleData,
    UpdateConfigData,
    WrappedRequest,
    WrappedResponse,
    LaunchExodosContentData,
    PlaylistUpdateData,
} from "@shared/back/types";
import { overwriteConfigData } from "@shared/config/util";
import { IGameInfo } from "@shared/game/interfaces";
import { GamePlaylist } from "@shared/interfaces";
import { ILogEntry, ILogPreEntry } from "@shared/Log/interface";
import { PreferencesFile } from "@shared/preferences/PreferencesFile";
import {
    defaultPreferencesData,
    overwritePreferenceData,
} from "@shared/preferences/util";
import {
    createErrorProxy,
    deepCopy,
    isErrorProxy,
    fixSlashes,
    readJsonFile,
} from "@shared/Util";
import { Coerce } from "@shared/utils/Coerce";
import { MessageBoxOptions, OpenExternalOptions } from "electron";
import * as http from "http";
import * as path from "path";
import * as WebSocket from "ws";
import { v4 as uuid } from "uuid";
import { EventEmitter } from "events";
import { ConfigFile } from "./config/ConfigFile";
import { loadExecMappingsFile } from "./Execs";
import { GameLauncher } from "./game/GameLauncher";
import { BackState } from "./types";
import { difObjects } from "./util/misc";
import { FileServer } from "./backend/fileServer";
import { PlaylistManager } from "./playlist/PlaylistManager";
import { DefaultCommandMapping } from "@shared/mappings/interfaces";
// Make sure the process.send function is available
type Required<T> = T extends undefined ? never : T;
const send: Required<typeof process.send> = process.send
    ? process.send.bind(process)
    : () => {
          throw new Error("process.send is undefined.");
      };

const state: BackState = {
    isInitialized: false,
    isExit: false,
    server: createErrorProxy("server"),
    fileServer: undefined,
    secret: createErrorProxy("secret"),
    preferences: createErrorProxy("preferences"),
    config: createErrorProxy("config"),
    configFolder: createErrorProxy("configFolder"),
    exePath: createErrorProxy("exePath"),
    basePath: createErrorProxy("basePath"),
    localeCode: createErrorProxy("countryCode"),
    playlistManager: new PlaylistManager(),
    messageQueue: [],
    isHandling: false,
    messageEmitter: new EventEmitter() as any,
    init: {
        0: false,
        1: false,
    },
    initEmitter: new EventEmitter() as any,
    logs: [],
    themeFiles: [],
    execMappings: [],
    queries: {},
    commandMappings: {
        defaultMapping: DefaultCommandMapping,
        commandsMapping: [],
    },
};

const preferencesFilename = "preferences.json";
const configFilename = "config.json";
const commandMappingsFilename = "mappings.json";

process.on("message", initialize);
process.on("disconnect", () => {
    exit();
});

async function initialize(message: any, _: any): Promise<void> {
    if (state.isInitialized) {
        return;
    }
    state.isInitialized = true;

    const content: BackInitArgs = JSON.parse(message);
    state.secret = content.secret;
    state.configFolder = content.configFolder;
    state.localeCode = content.localeCode;
    state.exePath = content.exePath;
    state.basePath = content.basePath;

    state.preferences = await PreferencesFile.readOrCreateFile(
        path.join(state.configFolder, preferencesFilename)
    );
    state.config = await ConfigFile.readOrCreateFile(
        path.join(state.configFolder, configFilename)
    );
    try {
        state.commandMappings = await readJsonFile(
            path.join(state.configFolder, commandMappingsFilename)
        );
    } catch (e) {
        console.error(
            `Cannot load mappings file. ${e}. Check if file exists and have valid values. Without that file most of the entries won't work.`
        );
    }

    await ConfigFile.readOrCreateFile(
        path.join(state.configFolder, configFilename)
    );
    if (!path.isAbsolute(state.config.exodosPath)) {
        state.config.exodosPath = path.join(
            state.basePath,
            state.config.exodosPath
        );
    }
    console.log("Exodos path: " + state.config.exodosPath);

    console.info(
        `Starting exogui with ${state.config.exodosPath} exodos path.`
    );
    console.log("Starting directory: " + process.cwd());

    try {
        process.chdir(state.configFolder);
        console.log("New directory: " + state.configFolder);
    } catch (err) {
        console.log("chdir: " + err);
    }

    await initializePlaylistManager();

    // Load Exec Mappings
    loadExecMappingsFile(
        path.join(state.config.exodosPath, state.config.jsonFolderPath),
        (content) => log({ source: "Launcher", content })
    )
        .then((data) => {
            state.execMappings = data;
        })
        .catch((error) => {
            log({
                source: "Launcher",
                content: `Failed to load exec mappings file. Ignore if on Windows. - ${error}`,
            });
        })
        .finally(() => {
            state.init[BackInit.EXEC] = true;
            state.initEmitter.emit(BackInit.EXEC);
        });

    state.fileServer = new FileServer(state.config, log);
    await state.fileServer.start();

    const serverPort = await startMainServer(content.acceptRemote);
    if (serverPort < 0) {
        setImmediate(exit);
    }
    send(serverPort);
}

const startMainServer = async (acceptRemote: boolean): Promise<number> =>
    new Promise<number>((resolve) => {
        const minPort = state.config.backPortMin;
        const maxPort = state.config.backPortMax;

        let port: number = minPort - 1;
        let server: WebSocket.Server | undefined;
        tryListen();

        function tryListen() {
            if (server) {
                server.off("error", onError);
                server.off("listening", onceListening);
            }

            if (port++ < maxPort) {
                server = new WebSocket.Server({
                    host: acceptRemote ? undefined : "127.0.0.1",
                    port: port,
                });
                server.on("error", onError);
                server.on("listening", onceListening);
            } else {
                done(
                    new Error(
                        `Failed to open server. All attempted ports are already in use (Ports: ${minPort} - ${maxPort}).`
                    )
                );
            }
        }

        function onError(error: Error): void {
            if ((error as any).code === "EADDRINUSE") {
                tryListen();
            } else {
                done(error);
            }
        }
        function onceListening() {
            done(undefined);
        }
        function done(error: Error | undefined) {
            if (server) {
                server.off("error", onError);
                server.off("listening", onceListening);
                state.server = server;
                state.server.on("connection", onConnect);
            }
            if (error) {
                log({
                    source: "Back",
                    content: "Failed to open WebSocket server.\n" + error,
                });
                resolve(-1);
            } else {
                resolve(port);
            }
        }
    });

async function initializePlaylistManager() {
    const playlistFolder = path.join(
        state.config.exodosPath,
        state.config.playlistFolderPath
    );

    const onPlaylistAddOrUpdate = function (playlist: GamePlaylist): void {
        // Clear all query caches that uses this playlist
        const hashes = Object.keys(state.queries);
        for (let hash of hashes) {
            const cache = state.queries[hash];
            if (cache.query.playlistId === playlist.filename) {
                delete state.queries[hash]; // Clear query from cache
            }
        }
        broadcast<PlaylistUpdateData>({
            id: "",
            type: BackOut.PLAYLIST_UPDATE,
            data: playlist,
        });
    };

    state.playlistManager.init({
        playlistFolder,
        log,
        onPlaylistAddOrUpdate,
    });

    state.init[BackInit.PLAYLISTS] = true;
    state.initEmitter.emit(BackInit.PLAYLISTS);
}

function onConnect(
    this: WebSocket.Server,
    socket: WebSocket,
    _: http.IncomingMessage
): void {
    socket.onmessage = function onAuthMessage(event) {
        if (event.data === state.secret) {
            socket.onmessage = onMessageWrap;
            socket.send("auth successful"); // (reply with some garbage data)
        } else {
            socket.close();
        }
    };
}

async function onMessageWrap(event: WebSocket.MessageEvent) {
    const [req, error] = parseWrappedRequest(event.data);
    if (error || !req) {
        console.error(
            "Failed to parse incoming WebSocket request (see error below):\n",
            error
        );
        return;
    }

    // Responses are handled instantly - requests and handled in queue
    // (The back could otherwise "soft lock" if it makes a request to the renderer while it is itself handling a request)
    if (req.type === BackIn.GENERIC_RESPONSE) {
        state.messageEmitter.emit(req.id, req);
    } else {
        state.messageQueue.push(event);
        if (!state.isHandling) {
            state.isHandling = true;
            while (state.messageQueue.length > 0) {
                const message = state.messageQueue.shift();
                if (message) {
                    await onMessage(message);
                }
            }
            state.isHandling = false;
        }
    }
}

async function onMessage(event: WebSocket.MessageEvent): Promise<void> {
    const [req, error] = parseWrappedRequest(event.data);
    if (error || !req) {
        console.error(
            "Failed to parse incoming WebSocket request (see error below):\n",
            error
        );
        return;
    }

    state.messageEmitter.emit(req.id, req);

    switch (req.type) {
        case BackIn.ADD_LOG:
            {
                const reqData: AddLogData = req.data;
                log(reqData, req.id);
            }
            break;

        case BackIn.GET_MAIN_INIT_DATA:
            {
                respond<GetMainInitDataResponse>(event.target, {
                    id: req.id,
                    type: BackOut.GET_MAIN_INIT_DATA,
                    data: {
                        preferences: state.preferences,
                        config: state.config,
                    },
                });
            }
            break;

        case BackIn.GET_RENDERER_INIT_DATA:
            {
                respond<GetRendererInitDataResponse>(event.target, {
                    id: req.id,
                    type: BackOut.GENERIC_RESPONSE,
                    data: {
                        preferences: state.preferences,
                        config: state.config,
                        commandMappings: state.commandMappings,
                        fileServerPort: state.fileServer?.port ?? -1,
                        log: state.logs,
                        themes: state.themeFiles.map((theme) => ({
                            entryPath: theme.entryPath,
                            meta: theme.meta,
                        })),
                        playlists: state.init[BackInit.PLAYLISTS]
                            ? state.playlistManager.playlists
                            : undefined,
                        localeCode: state.localeCode,
                    },
                });
            }
            break;

        case BackIn.INIT_LISTEN:
            {
                const done: BackInit[] = [];
                for (let key in state.init) {
                    const init: BackInit = key as any;
                    if (state.init[init]) {
                        done.push(init);
                    } else {
                        state.initEmitter.once(init, () => {
                            respond<InitEventData>(event.target, {
                                id: "",
                                type: BackOut.INIT_EVENT,
                                data: { done: [init] },
                            });
                        });
                    }
                }

                respond<InitEventData>(event.target, {
                    id: req.id,
                    type: BackOut.INIT_EVENT,
                    data: { done },
                });
            }
            break;

        case BackIn.SET_LOCALE:
            {
                const reqData: SetLocaleData = req.data;

                state.localeCode = reqData;

                respond<LocaleUpdateData>(event.target, {
                    id: req.id,
                    type: BackOut.LOCALE_UPDATE,
                    data: reqData,
                });
            }
            break;

        case BackIn.GET_EXEC:
            {
                respond<GetExecData>(event.target, {
                    id: req.id,
                    type: BackOut.GENERIC_RESPONSE,
                    data: state.execMappings,
                });
            }
            break;

        case BackIn.LAUNCH_ADDAPP:
            {
                const reqData: LaunchAddAppData = req.data;
                const { game, addApp } = reqData;

                if (addApp) {
                    GameLauncher.launchAdditionalApplication({
                        addApp,
                        fpPath: path.resolve(state.config.exodosPath),
                        native:
                            (game &&
                                state.config.nativePlatforms.some(
                                    (p) => p === game.platform
                                )) ||
                            false,
                        mappings: state.commandMappings,
                        execMappings: state.execMappings,
                        log: log,
                        openDialog: openDialog(event.target),
                        openExternal: openExternal(event.target),
                    });
                    break;
                }

                respond(event.target, {
                    id: req.id,
                    type: BackOut.GENERIC_RESPONSE,
                    data: undefined,
                });
            }
            break;

        case BackIn.LAUNCH_COMMAND:
            {
                const reqData: LaunchExodosContentData = req.data;
                const appPath = fixSlashes(
                    path.join(
                        path.resolve(state.config.exodosPath),
                        reqData.path
                    )
                );
                GameLauncher.launchCommand(
                    appPath,
                    "",
                    state.commandMappings,
                    log
                );
                respond(event.target, {
                    id: req.id,
                    type: BackOut.GENERIC_RESPONSE,
                    data: undefined,
                });
            }
            break;

        case BackIn.LAUNCH_GAME:
            {
                const reqData: LaunchGameData = req.data;

                const { game, addApps } = reqData;
                if (game) {
                    GameLauncher.launchGame({
                        game,
                        addApps,
                        fpPath: path.resolve(state.config.exodosPath),
                        native: state.config.nativePlatforms.some(
                            (p) => p === game.platform
                        ),
                        execMappings: state.execMappings,
                        mappings: state.commandMappings,
                        log,
                        openDialog: openDialog(event.target),
                        openExternal: openExternal(event.target),
                    });
                }

                respond(event.target, {
                    id: req.id,
                    type: BackOut.GENERIC_RESPONSE,
                    data: undefined,
                });
            }
            break;

        case BackIn.LAUNCH_GAME_SETUP:
            {
                const reqData: LaunchGameData = req.data;
                const { game, addApps } = reqData;

                if (game) {
                    GameLauncher.launchGameSetup({
                        game,
                        addApps,
                        fpPath: path.resolve(state.config.exodosPath),
                        native: state.config.nativePlatforms.some(
                            (p) => p === game.platform
                        ),
                        mappings: state.commandMappings,
                        execMappings: state.execMappings,
                        log,
                        openDialog: openDialog(event.target),
                        openExternal: openExternal(event.target),
                    });
                }

                respond(event.target, {
                    id: req.id,
                    type: BackOut.GENERIC_RESPONSE,
                    data: undefined,
                });
            }
            break;

        case BackIn.UPDATE_CONFIG:
            {
                const reqData: UpdateConfigData = req.data;

                const newConfig = deepCopy(state.config);
                overwriteConfigData(newConfig, reqData);

                try {
                    await ConfigFile.saveFile(
                        path.join(state.configFolder, configFilename),
                        newConfig
                    );
                } catch (error) {
                    log({
                        source: "Launcher",
                        content: error?.toString() ?? "",
                    });
                }

                respond(event.target, {
                    id: req.id,
                    type: BackOut.GENERIC_RESPONSE,
                });
            }
            break;

        case BackIn.UPDATE_PREFERENCES:
            {
                const dif = difObjects(
                    defaultPreferencesData,
                    state.preferences,
                    req.data
                );
                if (dif) {
                    overwritePreferenceData(state.preferences, dif);
                    await PreferencesFile.saveFile(
                        path.join(state.configFolder, preferencesFilename),
                        state.preferences
                    );
                }
                respond(event.target, {
                    id: req.id,
                    type: BackOut.UPDATE_PREFERENCES_RESPONSE,
                    data: state.preferences,
                });
            }
            break;

        case BackIn.GET_PLAYLISTS:
            {
                respond<GetPlaylistResponse>(event.target, {
                    id: req.id,
                    type: BackOut.GENERIC_RESPONSE,
                    data: state.playlistManager.playlists,
                });
            }
            break;

        case BackIn.QUIT:
            {
                respond(event.target, {
                    id: req.id,
                    type: BackOut.QUIT,
                });
                exit();
            }
            break;
    }
}

/** Exit the process cleanly. */
function exit() {
    if (!state.isExit) {
        state.isExit = true;

        Promise.all([
            // Close WebSocket server
            isErrorProxy(state.server)
                ? undefined
                : new Promise<void>((resolve) =>
                      state.server.close((error) => {
                          if (error) {
                              console.warn(
                                  "An error occurred whie closing the WebSocket server.",
                                  error
                              );
                          }
                          resolve();
                      })
                  ),
            // Close file server
            new Promise<void>((resolve) =>
                state.fileServer?.server.close((error) => {
                    if (error) {
                        console.warn(
                            "An error occurred whie closing the file server.",
                            error
                        );
                    }
                    resolve();
                })
            ),
        ]).then(() => {
            process.exit();
        });
    }
}

export function onGameUpdated(game: IGameInfo): void {
    if (!isErrorProxy(state.server)) {
        const res: WrappedResponse<IGameInfo> = {
            id: "",
            type: BackOut.GAME_CHANGE,
            data: game,
        };
        const message = JSON.stringify(res);
        state.server.clients.forEach((socket) => {
            if (socket.onmessage === onMessageWrap) {
                console.log(`Broadcast: ${BackOut[res.type]}`);
                // (Check if authorized)
                socket.send(message);
            }
        });
    }
}

function respond<T>(target: WebSocket, response: WrappedResponse<T>): void {
    target.send(JSON.stringify(response));
}

function broadcast<T>(response: WrappedResponse<T>): number {
    let count = 0;
    if (!isErrorProxy(state.server)) {
        const message = JSON.stringify(response);
        state.server.clients.forEach((socket) => {
            if (socket.onmessage === onMessageWrap) {
                console.log(`Broadcast: ${BackOut[response.type]}`);
                // (Check if authorized)
                socket.send(message);
                count += 1;
            }
        });
    }
    return count;
}

function log(preEntry: ILogPreEntry, id?: string): void {
    const entry: ILogEntry = {
        source: preEntry.source,
        content: preEntry.content,
        timestamp: Date.now(),
    };

    if (typeof entry.source !== "string") {
        console.warn(
            `Type Warning! A log entry has a source of an incorrect type!\n  Type: "${typeof entry.source}"\n  Value: "${
                entry.source
            }"`
        );
        entry.source = entry.source + "";
    }
    if (typeof entry.content !== "string") {
        console.warn(
            `Type Warning! A log entry has content of an incorrect type!\n  Type: "${typeof entry.content}"\n  Value: "${
                entry.content
            }"`
        );
        entry.content = entry.content + "";
    }
    state.logs.push(entry);

    broadcast({
        id: id || "",
        type: BackOut.LOG_ENTRY_ADDED,
        data: {
            entry,
            index: state.logs.length - 1,
        },
    });
}

function openDialog(target: WebSocket) {
    return (options: MessageBoxOptions) => {
        return new Promise<number>((resolve, _) => {
            const id = uuid();

            state.messageEmitter.once(id, (req: WrappedRequest) => {
                const reqData: OpenDialogResponseData = req.data;
                resolve(reqData);
            });

            respond<OpenDialogData>(target, {
                id,
                data: options,
                type: BackOut.OPEN_DIALOG,
            });
        });
    };
}

function openExternal(target: WebSocket) {
    return (url: string, options?: OpenExternalOptions) => {
        return new Promise<void>((resolve, reject) => {
            const id = uuid();

            state.messageEmitter.once(
                id,
                (req: WrappedRequest<OpenExternalResponseData>) => {
                    if (req.data && req.data.error) {
                        const error = new Error();
                        error.name = req.data.error.name;
                        error.message = req.data.error.message;
                        error.stack = req.data.error.stack;

                        reject(error);
                    } else {
                        resolve();
                    }
                }
            );

            respond<OpenExternalData>(target, {
                id,
                data: { url, options },
                type: BackOut.OPEN_EXTERNAL,
            });
        });
    };
}

function parseWrappedRequest(
    data: string | Buffer | ArrayBuffer | Buffer[]
): [WrappedRequest<any>, undefined] | [undefined, Error] {
    // Parse data into string
    let str: string | undefined;
    if (typeof data === "string") {
        // String
        str = data;
    } else if (typeof data === "object") {
        if (Buffer.isBuffer(data)) {
            // Buffer
            str = data.toString();
        } else if (Array.isArray(data)) {
            // Buffer[]
            str = Buffer.concat(data).toString();
        } else {
            // ArrayBuffer
            str = Buffer.from(data).toString();
        }
    }

    if (typeof str !== "string") {
        return [
            undefined,
            new Error(
                'Failed to parse WrappedRequest. Failed to convert "data" into a string.'
            ),
        ];
    }

    // Parse data string into object
    let json: Record<string, any>;
    try {
        json = JSON.parse(str);
    } catch (error) {
        if (error && typeof error === "object" && "message" in error) {
            error.message =
                'Failed to parse WrappedRequest. Failed to convert "data" into an object.\n' +
                Coerce.str(error.message);
        }
        return [undefined, error as Error];
    }

    // Create result (and ensure the types except for data)
    const result: WrappedRequest<any> = {
        id: Coerce.str(json.id),
        type: Coerce.num(json.type),
        data: json.data, // @TODO The types of the data should also be enforced somehow (probably really annoying to get right)
    };

    return [result, undefined];
}
