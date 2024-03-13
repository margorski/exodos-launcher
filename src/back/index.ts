import {
    AddLogData,
    BackIn,
    BackInit,
    BackInitArgs,
    BackOut,
    BrowseViewIndexData,
    BrowseViewIndexResponseData,
    BrowseViewPageData,
    BrowseViewPageResponseData,
    ExodosStateData,
    GetAllGamesResponseData,
    GetExecData,
    GetGameData,
    GetGameResponseData,
    GetGamesTotalResponseData,
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
    QuickSearchData,
    QuickSearchResponseData,
    RandomGamesData,
    RandomGamesResponseData,
    SetLocaleData,
    UpdateConfigData,
    ViewGame,
    WrappedRequest,
    WrappedResponse,
    LaunchExodosContentData,
    PlaylistUpdateData,
} from "@shared/back/types";
import { overwriteConfigData } from "@shared/config/util";
import { EXODOS_GAMES_PLATFORM_NAME } from "@shared/constants";
import {
    FilterGameOpts,
    filterGames,
    orderGames,
} from "@shared/game/GameFilter";
import { IAdditionalApplicationInfo, IGameInfo } from "@shared/game/interfaces";
import { GamePlaylist, GamePlaylistEntry } from "@shared/interfaces";
import { ILogEntry, ILogPreEntry } from "@shared/Log/interface";
import { GameOrderBy, GameOrderReverse } from "@shared/order/interfaces";
import { IThumbnailsInfo } from "@shared/platform/interfaces";
import { PreferencesFile } from "@shared/preferences/PreferencesFile";
import {
    defaultPreferencesData,
    overwritePreferenceData,
} from "@shared/preferences/util";
import {
    createErrorProxy,
    deepCopy,
    isErrorProxy,
    getFilePathExtension,
    fixSlashes,
} from "@shared/Util";
import { Coerce } from "@shared/utils/Coerce";
import { createHash } from "crypto";
import { MessageBoxOptions, OpenExternalOptions } from "electron";
import * as fs from "fs";
import * as http from "http";
import * as mime from "mime";
import * as path from "path";
import * as WebSocket from "ws";
import { v4 as uuid } from "uuid";

import { EventEmitter } from "events";
import { ConfigFile } from "./config/ConfigFile";
import { loadExecMappingsFile } from "./Execs";
import { GameManager } from "./game/GameManager";
import { GameLauncher } from "./game/GameLauncher";
import { BackQuery, BackQueryCache, BackState } from "./types";
import { FolderWatcher } from "./util/FolderWatcher";
import { walkSync, difObjects } from "./util/misc";
import { PlaylistManager } from "./playlist/PlaylistHelper";
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
    fileServer: new http.Server(onFileServerRequest),
    fileServerPort: -1,
    secret: createErrorProxy("secret"),
    preferences: createErrorProxy("preferences"),
    config: createErrorProxy("config"),
    configFolder: createErrorProxy("configFolder"),
    exePath: createErrorProxy("exePath"),
    localeCode: createErrorProxy("countryCode"),
    gameManager: new GameManager(),
    messageQueue: [],
    isHandling: false,
    messageEmitter: new EventEmitter() as any,
    init: {
        0: false,
        1: false,
        2: false,
    },
    initEmitter: new EventEmitter() as any,
    logs: [],
    themeFiles: [],
    playlistManager: new PlaylistManager(),
    execMappings: [],
    installedGames: [],
    queries: {},
};

const preferencesFilename = "preferences.json";
const configFilename = "config.json";

process.on("message", initialize);
process.on("disconnect", () => {
    exit();
});

function addInstalledGamesPlaylist(doBroadcast: boolean = true) {
    const dosPlatform = state.gameManager.dosPlatform;
    if (!dosPlatform) {
        console.log(
            "Cannot create installed game playlist. MS-DOS platform not loaded yet."
        );
        return;
    }

    const gamesList = state.installedGames
        .map((gameName) => {
            const gameInPlatform = dosPlatform.collection.games.find((game) =>
                game.applicationPath.split("\\").includes(gameName)
            );
            if (gameInPlatform) return { id: gameInPlatform.id };
            else return;
        })
        .filter((g) => g) as GamePlaylistEntry[];

    const playlistDummyFilename = "installedgamesdummyfile";
    var existingPlaylistIndex = state.playlistManager.playlists.findIndex(
        (p) => p.filename === playlistDummyFilename
    );
    if (existingPlaylistIndex !== -1) {
        state.playlistManager.playlists[existingPlaylistIndex].games =
            gamesList;
    } else
        state.playlistManager.playlists.unshift({
            title: "Installed games",
            description: "A list of installed games.",
            author: "",
            icon: "",
            library: `${EXODOS_GAMES_PLATFORM_NAME}.xml`,
            filename: playlistDummyFilename,
            games: gamesList,
        });

    // Clear all query caches that uses this playlist
    const hashes = Object.keys(state.queries);
    for (let hash of hashes) {
        const cache = state.queries[hash];
        if (cache.query.playlistId === playlistDummyFilename) {
            delete state.queries[hash]; // Clear query from cache
        }
    }

    if (doBroadcast) {
        broadcast<PlaylistUpdateData>({
            id: "",
            type: BackOut.PLAYLIST_UPDATE,
            data: state.playlistManager.playlists[0],
        });
    }
}

function initExodosMagazinesWatcher() {
    const magazinesPath = path.resolve(
        path.join(state.config.exodosPath, "eXo/Magazines/")
    );

    console.log(
        `Checking if exodos magazines exists in path ${magazinesPath}...`
    );
    const magazinesPathExists = fs.existsSync(magazinesPath);
    if (magazinesPathExists) {
        console.log(`Found magazines, enabling magazines`);
        broadcast<ExodosStateData>({
            id: "",
            type: BackOut.EXODOS_STATE_UPDATE,
            data: {
                magazinesEnabled: true,
            },
        });
    } else {
        console.log(`Magazines not found, disabling magazines`);
    }
}

function initExodosInstalledGamesWatcher() {
    const gamesPath = path.resolve(
        path.join(state.config.exodosPath, "eXo/eXoDOS/")
    );

    console.log(
        `Initializing installed games watcher with ${gamesPath} path...`
    );
    const installedGamesWatcher = new FolderWatcher(gamesPath, {
        recursionDepth: 0,
    });

    installedGamesWatcher
        .on("ready", () => {
            console.log("Installed games watcher is ready.");
            installedGamesWatcher
                .on("add", (path) => {
                    console.log(`Game ${path} added, rescan installed games.`);
                    rescanInstalledGamesAndBroadcast(gamesPath);
                })
                .on("remove", (path) => {
                    console.log(
                        `Game ${path} has been removed, rescan installed games.`
                    );
                    rescanInstalledGamesAndBroadcast(gamesPath);
                });
            rescanInstalledGamesAndBroadcast(gamesPath);
            console.log("Initial scan complete. Ready for changes");

            broadcast<ExodosStateData>({
                id: "",
                type: BackOut.EXODOS_STATE_UPDATE,
                data: {
                    gamesEnabled: true,
                },
            });
        })
        .on("error", (error) => console.log(`Watcher error: ${error}`));
}

function rescanInstalledGamesAndBroadcast(gamesPath: string) {
    state.installedGames = rescanInstalledGames(gamesPath);
    addInstalledGamesPlaylist(true);
}

function rescanInstalledGames(gamesPath: string) {
    console.log(`Scanning for new games in ${gamesPath}`);

    if (!fs.existsSync(gamesPath)) {
        console.error(
            `Directory ${gamesPath} doesn't exists, that could mean that exodos is not installed.`
        );
        return [];
    }

    const installedGames = fs
        .readdirSync(gamesPath, { withFileTypes: true })
        .filter((dirent) => dirent.isDirectory())
        .filter((dirent) => dirent.name !== `!dos`)
        .map((dirent) => dirent.name);
    return installedGames;
}

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

    state.preferences = await PreferencesFile.readOrCreateFile(
        path.join(state.configFolder, preferencesFilename)
    );
    state.config = await ConfigFile.readOrCreateFile(
        path.join(state.configFolder, configFilename)
    );

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

    const playlistFolder = path.join(
        state.config.exodosPath,
        state.config.playlistFolderPath
    );

    await state.playlistManager.load({
        playlistFolder,
        log,
        onPlaylistAddOrUpdate: function (playlist: GamePlaylist): void {
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
        },
    });
    state.init[BackInit.PLAYLISTS] = true;
    state.initEmitter.emit(BackInit.PLAYLISTS);

    initializeGameManager();

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

    state.fileServerPort = await startFileServer(content.acceptRemote);
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
                    host: acceptRemote ? undefined : "localhost",
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

const startFileServer = async (acceptRemote: boolean): Promise<number> =>
    new Promise<number>((resolve) => {
        const minPort = state.config.imagesPortMin;
        const maxPort = state.config.imagesPortMax;

        let port = minPort - 1;
        state.fileServer.once("listening", onceListening);
        state.fileServer.on("error", onError);
        tryListen();

        function onceListening() {
            done(undefined);
        }
        function onError(error: Error) {
            if ((error as any).code === "EADDRINUSE") {
                tryListen();
            } else {
                done(error);
            }
        }
        function tryListen() {
            if (port++ < maxPort) {
                state.fileServer.listen(
                    port,
                    acceptRemote ? undefined : "localhost"
                );
            } else {
                done(
                    new Error(
                        `All attempted ports are already in use (Ports: ${minPort} - ${maxPort}).`
                    )
                );
            }
        }
        function done(error: Error | undefined) {
            state.fileServer.off("listening", onceListening);
            state.fileServer.off("error", onError);
            if (error) {
                log({
                    source: "Back",
                    content: "Failed to open HTTP server.\n" + error,
                });
                resolve(-1);
            } else {
                resolve(port);
            }
        }
    });

const initializeGameManager = () => {
    const boxImagesPath = path.join(
        state.config.exodosPath,
        "Images/MS-DOS/Box - Front"
    );

    console.info(`Loading thumbnails from ${boxImagesPath} path.`);
    const thumbnails: IThumbnailsInfo[] = [];
    for (const s of walkSync(boxImagesPath)) {
        // filename to id
        const coverPath = s.path.replace("../", "");
        thumbnails.push({
            GameName: s.filename.replace("_", ":").split("-0")[0],
            BoxThumbnail: coverPath,
            Box3dThumbnail: "",
            TitleThumbnail: "",
        });
    }

    const platformsPath = path.join(
        state.config.exodosPath,
        state.config.platformFolderPath
    );

    console.info(
        `Initializing gameManager with ${platformsPath} path and ${thumbnails.length} thumbnails`
    );
    state.gameManager
        .loadPlatforms(platformsPath, thumbnails)
        .then((errors) => {
            if (errors.length > 0) {
                console.error(
                    `${errors.length} platform(s) failed to load. Errors:`
                );
                for (let error of errors) {
                    console.error(error);
                }
            }
        })
        .catch((error) => {
            console.error(error);
        })
        .finally(() => {
            state.init[BackInit.GAMES] = true;
            state.initEmitter.emit(BackInit.GAMES);
            addInstalledGamesPlaylist(false);
        });
};

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
                const platforms: Record<string, string[]> = {};
                for (let i = 0; i < state.gameManager.platforms.length; i++) {
                    const p = state.gameManager.platforms[i];
                    if (!platforms[p.library]) {
                        platforms[p.library] = [];
                    }
                    platforms[p.library].push(p.name);
                }

                respond<GetRendererInitDataResponse>(event.target, {
                    id: req.id,
                    type: BackOut.GENERIC_RESPONSE,
                    data: {
                        preferences: state.preferences,
                        config: state.config,
                        fileServerPort: state.fileServerPort,
                        log: state.logs,
                        themes: state.themeFiles.map((theme) => ({
                            entryPath: theme.entryPath,
                            meta: theme.meta,
                        })),
                        playlists: state.init[BackInit.PLAYLISTS]
                            ? state.playlistManager.playlists
                            : undefined,
                        platforms: platforms,
                        localeCode: state.localeCode,
                    },
                });
                if (state.gameManager.dosPlatform) {
                    initExodosInstalledGamesWatcher();
                    initExodosMagazinesWatcher();
                }
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

        case BackIn.GET_GAMES_TOTAL:
            {
                respond<GetGamesTotalResponseData>(event.target, {
                    id: req.id,
                    type: BackOut.GENERIC_RESPONSE,
                    data: countGames(),
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

                const platforms = state.gameManager.platforms;
                for (let i = 0; i < platforms.length; i++) {
                    const addApp = platforms[
                        i
                    ].collection.additionalApplications.find(
                        (item) => item.id === reqData.id
                    );
                    if (addApp) {
                        const game = findGame(addApp.gameId);
                        GameLauncher.launchAdditionalApplication({
                            addApp,
                            fpPath: path.resolve(state.config.exodosPath),
                            native:
                                (game &&
                                    state.config.nativePlatforms.some(
                                        (p) => p === game.platform
                                    )) ||
                                false,
                            execMappings: state.execMappings,
                            log: log,
                            openDialog: openDialog(event.target),
                            openExternal: openExternal(event.target),
                        });
                        break;
                    }
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
                GameLauncher.launchCommand(appPath, "", log);
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

                const game = findGame(reqData.id);
                const addApps = findAddApps(reqData.id);

                if (game) {
                    GameLauncher.launchGame({
                        game,
                        addApps,
                        fpPath: path.resolve(state.config.exodosPath),
                        native: state.config.nativePlatforms.some(
                            (p) => p === game.platform
                        ),
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

        case BackIn.LAUNCH_GAME_SETUP:
            {
                const reqData: LaunchGameData = req.data;
                const game = findGame(reqData.id);
                const addApps = findAddApps(reqData.id);

                if (game) {
                    GameLauncher.launchGameSetup({
                        game,
                        addApps,
                        fpPath: path.resolve(state.config.exodosPath),
                        native: state.config.nativePlatforms.some(
                            (p) => p === game.platform
                        ),
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

        case BackIn.GET_GAME:
            {
                const reqData: GetGameData = req.data;

                respond<GetGameResponseData>(event.target, {
                    id: req.id,
                    type: BackOut.GENERIC_RESPONSE,
                    data: {
                        game: findGame(reqData.id),
                        addApps: findAddApps(reqData.id),
                    },
                });
            }
            break;

        case BackIn.GET_ALL_GAMES:
            {
                const games: IGameInfo[] = [];
                for (let i = 0; i < state.gameManager.platforms.length; i++) {
                    const platform = state.gameManager.platforms[i];
                    games.splice(games.length, 0, ...platform.collection.games);
                }

                respond<GetAllGamesResponseData>(event.target, {
                    id: req.id,
                    type: BackOut.GENERIC_RESPONSE,
                    data: { games },
                });
            }
            break;

        case BackIn.RANDOM_GAMES:
            {
                const reqData: RandomGamesData = req.data;

                let allGames: IGameInfo[] = [];
                for (let platform of state.gameManager.platforms) {
                    Array.prototype.push.apply(
                        allGames,
                        platform.collection.games
                    );
                }

                if (!reqData.extreme) {
                    allGames = allGames.filter((game) => !game.extreme);
                }

                if (!reqData.broken) {
                    allGames = allGames.filter((game) => !game.broken);
                }

                const pickedGames: IGameInfo[] = [];
                for (let i = 0; i < reqData.count; i++) {
                    const index = (Math.random() * allGames.length) | 0;
                    const game = allGames[index];
                    if (game) {
                        pickedGames.push(game);
                        allGames.splice(index, 1);
                    }
                }

                respond<RandomGamesResponseData>(event.target, {
                    id: req.id,
                    type: BackOut.GENERIC_RESPONSE,
                    data: pickedGames,
                });
            }
            break;

        case BackIn.BROWSE_VIEW_PAGE:
            {
                const reqData: BrowseViewPageData = req.data;

                const query: BackQuery = {
                    extreme: reqData.query.extreme,
                    broken: reqData.query.broken,
                    library: reqData.query.library,
                    search: reqData.query.search,
                    orderBy: reqData.query.orderBy as GameOrderBy,
                    orderReverse: reqData.query
                        .orderReverse as GameOrderReverse,
                    playlistId: reqData.query.playlistId,
                };

                var cache = queryGames(query);

                respond<BrowseViewPageResponseData>(event.target, {
                    id: req.id,
                    type: BackOut.BROWSE_VIEW_PAGE_RESPONSE,
                    data: {
                        games: cache.viewGames.slice(
                            reqData.offset,
                            reqData.offset + reqData.limit
                        ),
                        offset: reqData.offset,
                        total: cache.games.length,
                    },
                });
            }
            break;

        case BackIn.BROWSE_VIEW_INDEX:
            {
                const reqData: BrowseViewIndexData = req.data;

                const query: BackQuery = {
                    extreme: reqData.query.extreme,
                    broken: reqData.query.broken,
                    library: reqData.query.library,
                    search: reqData.query.search,
                    orderBy: reqData.query.orderBy as GameOrderBy,
                    orderReverse: reqData.query
                        .orderReverse as GameOrderReverse,
                    playlistId: reqData.query.playlistId,
                };

                const hash = createHash("sha256")
                    .update(JSON.stringify(query))
                    .digest("base64");
                let cache = state.queries[hash];
                if (!cache) {
                    state.queries[hash] = cache = queryGames(query);
                } // @TODO Start clearing the cache if it gets too full

                let index = -1;
                for (let i = 0; i < cache.viewGames.length; i++) {
                    if (cache.viewGames[i].id === reqData.gameId) {
                        index = i;
                        break;
                    }
                }

                respond<BrowseViewIndexResponseData>(event.target, {
                    id: req.id,
                    type: BackOut.GENERIC_RESPONSE,
                    data: { index },
                });
            }
            break;

        case BackIn.QUICK_SEARCH:
            {
                const reqData: QuickSearchData = req.data;

                const query: BackQuery = {
                    extreme: reqData.query.extreme,
                    broken: reqData.query.broken,
                    library: reqData.query.library,
                    search: reqData.query.search,
                    orderBy: reqData.query.orderBy as GameOrderBy,
                    orderReverse: reqData.query
                        .orderReverse as GameOrderReverse,
                    playlistId: reqData.query.playlistId,
                };

                const hash = createHash("sha256")
                    .update(JSON.stringify(query))
                    .digest("base64");
                let cache = state.queries[hash];
                if (!cache) {
                    state.queries[hash] = cache = queryGames(query);
                }

                let result: string | undefined;
                let index: number | undefined;
                for (let i = 0; i < cache.games.length; i++) {
                    if (
                        cache.games[i].title
                            .toLowerCase()
                            .startsWith(reqData.search)
                    ) {
                        index = i;
                        result = cache.games[i].id;
                        break;
                    }
                }
                respond<QuickSearchResponseData>(event.target, {
                    id: req.id,
                    type: BackOut.GENERIC_RESPONSE,
                    data: {
                        id: result,
                        index: index,
                    },
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
// TODO: Move to file server
function onFileServerRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse
): void {
    try {
        let urlPath = decodeURIComponent(req.url || "");

        // Remove the get parameters
        const qIndex = urlPath.indexOf("?");
        if (qIndex >= 0) {
            urlPath = urlPath.substr(0, qIndex);
        }

        // Remove all leading slashes
        for (let i = 0; i < urlPath.length; i++) {
            if (urlPath[i] !== "/") {
                urlPath = urlPath.substr(i);
                break;
            }
        }

        const index = urlPath.indexOf("/");
        const firstItem = (
            index >= 0 ? urlPath.substr(0, index) : urlPath
        ).toLowerCase(); // First filename in the path string ("A/B/C" => "A" | "D" => "D")
        switch (firstItem) {
            // Image folder
            case "images":
                {
                    const imageFolder = path.join(
                        state.config.exodosPath,
                        state.config.imageFolderPath
                    );
                    const filePath = path.join(
                        imageFolder,
                        urlPath.substr(index + 1)
                    );
                    if (filePath.startsWith(imageFolder)) {
                        serveFile(req, res, filePath);
                    }
                }
                break;

            // Theme folder
            case "themes":
                {
                    const themeFolder = path.join(
                        state.config.exodosPath,
                        state.config.themeFolderPath
                    );
                    const index = urlPath.indexOf("/");
                    const relativeUrl =
                        index >= 0 ? urlPath.substr(index + 1) : urlPath;
                    const filePath = path.join(themeFolder, relativeUrl);
                    if (filePath.startsWith(themeFolder)) {
                        serveFile(req, res, filePath);
                    }
                }
                break;

            // Logos folder
            case "logos":
                {
                    const logoFolder = path.join(
                        state.config.exodosPath,
                        state.config.logoFolderPath
                    );
                    const filePath = path.join(
                        logoFolder,
                        urlPath.substr(index + 1)
                    );
                    if (filePath.startsWith(logoFolder)) {
                        serveFile(req, res, filePath);
                    }
                }
                break;

            // Exodos directory, serving html from there
            case "exo": {
                const extension = getFilePathExtension(urlPath);
                if (
                    extension.toLocaleLowerCase() === "html" ||
                    extension.toLocaleLowerCase() === "htm" ||
                    extension.toLocaleLowerCase() === "txt"
                ) {
                    const filePath = path.join(
                        state.config.exodosPath,
                        urlPath
                    );
                    serveFile(req, res, filePath);
                } else {
                    res.writeHead(404);
                    res.end();
                }
                break;
            }
            // Nothing
            default:
                {
                    res.writeHead(404);
                    res.end();
                }
                break;
        }
    } catch (error) {
        console.warn(error);
    }
}

function serveFile(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    filePath: string
): void {
    if (req.method === "GET" || req.method === "HEAD") {
        fs.stat(filePath, (error, stats) => {
            if (error || (stats && !stats.isFile())) {
                res.writeHead(404);
                res.end();
            } else {
                res.writeHead(200, {
                    "Content-Type": mime.getType(path.extname(filePath)) || "",
                    "Content-Length": stats.size,
                });
                if (req.method === "GET") {
                    const stream = fs.createReadStream(filePath);
                    stream.on("error", (error) => {
                        console.warn(
                            `File server failed to stream file. ${error}`
                        );
                        stream.destroy(); // Calling "destroy" inside the "error" event seems like it could case an endless loop (although it hasn't thus far)
                        if (!res.writableEnded) {
                            res.end();
                        }
                    });
                    stream.pipe(res);
                } else {
                    res.end();
                }
            }
        });
    } else {
        res.writeHead(404);
        res.end();
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
                state.fileServer.close((error) => {
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

type SearchGamesOpts = {
    extreme: boolean;
    broken: boolean;
    playlist?: GamePlaylist;
    /** String to use as a search query */
    query: string;
    /** The field to order the games by. */
    orderBy: GameOrderBy;
    /** The way to order the games. */
    orderReverse: GameOrderReverse;
    /** Library to search (all if none) */
    library?: string;
};

// TODO: Move to GameManager
function searchGames(opts: SearchGamesOpts): IGameInfo[] {
    // Build opts from preferences and query
    const filterOpts: FilterGameOpts = {
        search: opts.query,
        extreme: opts.extreme,
        broken: opts.broken,
        playlist: opts.playlist,
    };

    // Filter games
    const platforms = state.gameManager.platforms;
    let foundGames: IGameInfo[] = [];
    for (let i = 0; i < platforms.length; i++) {
        // If library matches filter, or no library filter given, filter this platforms games
        if (!opts.library || platforms[i].library === opts.library) {
            foundGames = foundGames.concat(
                filterGames(platforms[i].collection.games, filterOpts)
            );
        }
    }
    // Order games
    orderGames(foundGames, {
        orderBy: opts.orderBy,
        orderReverse: opts.orderReverse,
    });

    return foundGames;
}
// TODO: Move to game manager
function queryGames(query: BackQuery): BackQueryCache {
    const playlist = state.playlistManager.playlists.find(
        (p) => p.filename === query.playlistId
    );
    const results = searchGames({
        extreme: query.extreme,
        broken: query.broken,
        query: query.search,
        orderBy: query.orderBy,
        orderReverse: query.orderReverse,
        library: query.library,
        playlist: playlist,
    });

    const viewGames: ViewGame[] = [];
    for (let i = 0; i < results.length; i++) {
        const g = results[i];
        viewGames[i] = {
            id: g.id,
            title: g.title,
            convertedTitle: g.convertedTitle,
            platform: g.platform,
            genre: g.tags,
            developer: g.developer,
            publisher: g.publisher,
            releaseDate: g.releaseDate,
            thumbnailPath: g.thumbnailPath,
        };
    }

    return {
        query: query,
        games: results,
        viewGames: viewGames,
    };
}

/** Find the game with the specified ID. */
function findGame(gameId: string): IGameInfo | undefined {
    const platforms = state.gameManager.platforms;
    for (let i = 0; i < platforms.length; i++) {
        const games = platforms[i].collection.games;
        for (let j = 0; j < games.length; j++) {
            if (games[j].id === gameId) {
                return games[j];
            }
        }
    }
}

/** Find all add apps with the specified game ID. */
function findAddApps(gameId: string): IAdditionalApplicationInfo[] {
    const result: IAdditionalApplicationInfo[] = [];
    const platforms = state.gameManager.platforms;
    for (let i = 0; i < platforms.length; i++) {
        const addApps = platforms[i].collection.additionalApplications;
        for (let j = 0; j < addApps.length; j++) {
            if (addApps[j].gameId === gameId) {
                result.push(addApps[j]);
            }
        }
    }
    return result;
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

function countGames(): number {
    let count = 0;
    const platforms = state.gameManager.platforms;
    for (let i = 0; i < platforms.length; i++) {
        count += platforms[i].collection.games.length;
    }
    return count;
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
