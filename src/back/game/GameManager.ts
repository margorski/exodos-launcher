import { GameParser } from "@shared/game/GameParser";
import { IAdditionalApplicationInfo, IGameInfo } from "@shared/game/interfaces";
import { GamePlatform, IImageInfo } from "@shared/platform/interfaces";
import * as fastXmlParser from "fast-xml-parser";
import * as fs from "fs";
import * as path from "path";
import * as chokidar from "chokidar";
import { promisify } from "util";
import { copyError, loadGameMedia, walkSync } from "../util/misc";
import { GameManagerState, LoadPlatformError, ThumbnailList } from "./types";
import {
    PlaylistManager,
    PlaylistUpdatedFunc,
} from "@back/playlist/PlaylistManager";
import * as LaunchBoxHelper from "./LaunchBoxHelper";
import { BackQuery, BackQueryCache, LogFunc } from "@back/types";
import { GamePlaylist, GamePlaylistEntry } from "@shared/interfaces";
import { GameOrderBy, GameOrderReverse } from "@shared/order/interfaces";
import {
    FilterGameOpts,
    filterGames,
    orderGames,
} from "@shared/game/GameFilter";
import { readPlatformsFile } from "@back/platform/PlatformFile";
import { findGameImageCollection, findGameVideos } from "@back/util/images";
import { fixSlashes } from "@shared/Util";
import { onGameUpdated } from "..";

const readFile = promisify(fs.readFile);
const stat = promisify(fs.stat);

export type SearchGamesOpts = {
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

export interface IGameManagerOpts {
    exodosPath: string;
    platformsPath: string;
    playlistFolder: string;
    imagesPath: string;
    onPlaylistAddOrUpdate: PlaylistUpdatedFunc;
    log: LogFunc;
}

export class GameManager {
    EXTRAS_DIR = "Extras";

    private _opts?: IGameManagerOpts;

    private _state: GameManagerState = {
        platforms: [],
        platformsPath: "",
        installedGames: [],
        playlistManager: new PlaylistManager(),
        platformsFile: { platforms: [], media: [] },
    };

    public get platforms() {
        if (!this.initialized) throw new Error("GameManager not initialized.");
        return this._state.platforms;
    }

    public get playlists() {
        if (!this.initialized) throw new Error("GameManager not initialized.");
        return this._state.playlistManager.playlists;
    }

    public get initialized() {
        return !!this._opts;
    }

    public async init(opts: IGameManagerOpts) {
        if (this.initialized)
            throw new Error("GameManager already initialized.");
        this._opts = opts;

        await this._state.playlistManager.init({
            ...opts,
        });

        this._state.platformsFile = await readPlatformsFile(
            path.join(opts.platformsPath, "../Platforms.xml")
        );
        // ADD thumbnail on the GAME PARSE
        // GET ALL IMAGES ON GET GAME
        const platformErrors = await this.loadPlatforms(
            opts.platformsPath,
            opts.exodosPath,
            opts.imagesPath,
        );
        this.addInstalledGamesPlaylists();
        this.platforms
            .filter((p) => p.isGamePlatform)
            .forEach((p) =>
                this._initExodosInstalledGamesWatcher(p, opts.exodosPath)
            );

        return platformErrors;
    }

    public findPlatformByName(name: string): GamePlatform | undefined {
        if (!this.initialized) throw new Error("GameManager not initialized.");
        return this._state.platforms.find((p) => p.name === name);
    }

    public searchGames(opts: SearchGamesOpts): IGameInfo[] {
        if (!this.initialized) throw new Error("GameManager not initialized.");
        // Build opts from preferences and query
        const filterOpts: FilterGameOpts = {
            search: opts.query,
            playlist: opts.playlist,
        };

        // Filter games
        const platforms = this.platforms;
        let foundGames: IGameInfo[] = [];
        for (let i = 0; i < platforms.length; i++) {
            // If library matches filter, or no library filter given, filter this platforms games
            if (!opts.library || platforms[i].name === opts.library) {
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

    public queryGames(query: BackQuery): BackQueryCache {
        if (!this.initialized) throw new Error("GameManager not initialized.");
        const playlist = this.playlists.find(
            (p) => p.filename === query.playlistId
        );
        const results = this.searchGames({
            query: query.search,
            orderBy: query.orderBy,
            orderReverse: query.orderReverse,
            library: query.library,
            playlist: playlist,
        });

        return {
            query: query,
            games: results,
        };
    }

    public findGame(gameId: string): IGameInfo | undefined {
        if (!this.initialized) throw new Error("GameManager not initialized.");
        const platforms = this.platforms;
        for (let i = 0; i < platforms.length; i++) {
            const games = platforms[i].collection.games;
            for (let j = 0; j < games.length; j++) {
                if (games[j].id === gameId) {
                    return games[j];
                }
            }
        }
    }

    public getGame(gameId: string): {
        game: IGameInfo;
        addApps: IAdditionalApplicationInfo[];
    } {
        if (!this.initialized) throw new Error("GameManager not initialized.");

        console.log("GET GAME");
        const game = this.findGame(gameId);
        if (!game) throw new Error(`Game with id ${gameId} not found.`);

        const _addApps = this._getAddAppsForGame(game);
        return {
            game: game,
            addApps: this._getAddAppsForGame(game),
        };
    }

    public findAddApp(id: string): IAdditionalApplicationInfo | undefined {
        if (!this.initialized) throw new Error("GameManager not initialized.");
        const platforms = this._state.platforms;

        for (let i = 0; i < platforms.length; i++) {
            const addApp = platforms[i].collection.additionalApplications.find(
                (item) => item.id === id
            );
            if (addApp) return addApp;
        }
    }

    private _getAddAppsForGame(game: IGameInfo): IAdditionalApplicationInfo[] {
        if (!this.initialized) throw new Error("GameManager not initialized.");

        this._loadDynamicExtrasForGame(game);

        return [...this._getAdditionalApps(game.id)];
    }

    private _getAdditionalApps(gameId: string): IAdditionalApplicationInfo[] {
        const result: IAdditionalApplicationInfo[] = [];
        const platforms = this.platforms;
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

    private _loadDynamicExtrasForGame(game: IGameInfo) {
        if (!this.initialized) throw new Error("GameManager not initialized.");
        if (!game?.applicationPath)
            throw new Error("Game application path not set. Invalid data.");

        const relativeExtras = path.join(
            game?.applicationPath.split("\\").slice(0, -1).join("/"),
            this.EXTRAS_DIR
        );
        const gameExtrasPath = path.join(
            this._opts?.exodosPath!,
            relativeExtras
        );

        try {
            if (
                !fs.existsSync(gameExtrasPath) ||
                !fs.statSync(gameExtrasPath).isDirectory()
            ) {
                return [];
            }

            const dir = fs.readdirSync(gameExtrasPath);
            const files = dir.filter((f) =>
                fs.statSync(path.join(gameExtrasPath, f)).isFile()
            );

            const ignoredExtensions = ["bat", "bsh", "msh", ""];
            files
                .filter(
                    (f) => !ignoredExtensions.includes(f.split(".")?.[1] ?? "")
                )
                .map((f) => {
                    const name = f.split(".")[0];
                    const id = this._getExtrasId(game.id, f);
                    const addApp = this.findAddApp(id);
                    if (addApp) return addApp;
                    else {
                        const addApp = {
                            applicationPath: path.join(relativeExtras, f),
                            autoRunBefore: false,
                            gameId: game.id,
                            id: this._getExtrasId(game.id, f),
                            launchCommand: ``,
                            name,
                            waitForExit: false,
                        };
                        this.findPlatformByName(
                            game.platform
                        )?.collection.additionalApplications.push(addApp);
                        return addApp;
                    }
                });
        } catch (e) {
            console.error(
                `Error while reading extras directory: ${gameExtrasPath} Error: ${e}`
            );
            return [];
        }
    }

    private _getExtrasId(gameId: string, filename: string): string {
        return `${gameId}-${filename}`;
    }

    public countGames(): number {
        if (!this.initialized) throw new Error("GameManager not initialized.");
        let count = 0;
        const platforms = this.platforms;
        for (let i = 0; i < platforms.length; i++) {
            count += platforms[i].collection.games.length;
        }
        return count;
    }

    private async loadPlatforms(
        platformsPath: string,
        exodosPath: string,
        imagesPath: string,
    ): Promise<LoadPlatformError[]> {
        this._state.platformsPath = platformsPath;
        const platforms: GamePlatform[] = [];
        try {
            const libraryNames = this._state.platformsFile.platforms;
            console.log(
                `Loading platforms ${libraryNames} from ${platformsPath}`
            );
            for (let libraryName of libraryNames) {
                try {
                    console.log(
                        `Checking existence of platform ${libraryName} xml file..`
                    );
                    const platformFile = path.join(
                        this._state.platformsPath,
                        `${libraryName}.xml`
                    );
                    if ((await stat(platformFile)).isFile()) {
                        console.log(`Platform file found: ${platformFile}.`);
                        const newPlatform = new GamePlatform(
                            libraryName,
                            platformFile
                        );
                        platforms.push(newPlatform);
                    } else {
                        console.log(`Platform file not found: ${platformFile}`);
                    }
                } catch (e) {
                    console.error(e);
                }
            }
        } catch (e) {
            console.error(e);
        }

        // Read and parse all platform files
        const errors: LoadPlatformError[] = [];
        await Promise.all(
            platforms.map(async (platform) => {
                try {
                    console.log(
                        `Loading platform ${platform.name} ${platform.filePath}..`
                    );
                    const content = await readFile(platform.filePath);
                    const data: any | undefined = fastXmlParser.parse(
                        content.toString(),
                        {
                            ignoreAttributes: true,
                            ignoreNameSpace: true,
                            parseNodeValue: true,
                            parseAttributeValue: false,
                            parseTrueNumberOnly: true,
                            // @TODO Look into which settings are most appropriate
                        }
                    );
                    if (!LaunchBoxHelper.formatPlatformFileData(data)) {
                        throw new Error(
                            `Failed to parse XML file: ${platform.filePath}`
                        );
                    }
                    
                    // Load games
                    platform.collection = GameParser.parse(data, platform.name, exodosPath);

                    // Load images
                    const imagesRoot = path.join(exodosPath, imagesPath, platform.name);
                    const videoRoot = path.join(exodosPath, "Videos", platform.name);
                    const images = await findGameImageCollection(imagesRoot);
                    const videos = findGameVideos(videoRoot);
                    console.log(JSON.stringify(videos, undefined, 2));
                    for (const game of platform.collection.games) {
                        loadGameMedia(game, images, videos);
                    }

                    // Success!
                    this._state.platforms.push(platform);
                } catch (e) {
                    errors.push({
                        ...copyError(e),
                        filePath: platform.filePath,
                    });
                }
            })
        );

        return errors;
    }

    // TODO: Move to GameManager or new image class (ImageManager?)
    private _getThumbnailsForPlatform(
        exodosPath: string,
        platform: GamePlatform
    ): ThumbnailList {
        // Find thumbnail images in order of preference
        const categoryOrder = [
            'Box - Front',
            'Box - Front - Reconstructed',
            'Clear Logo',
            'Screenshot - Game Title',
        ];

        const thumbnails: ThumbnailList = {};

        // For each category, store each found game if it isn't already stored
        for (const category of categoryOrder) {
            const boxImagesPath = path.join(exodosPath, `Images/${platform.name}/${category}`);
            console.info(
                `Loading thumbnails from "${boxImagesPath}" path for ${platform.name} platform.`
            );
            try {
                for (const s of walkSync(boxImagesPath)) {
                    const lastIdx = s.filename.lastIndexOf("-0");
                    if (lastIdx > -1) {
                        const gameName = s.filename.slice(0, lastIdx);
                        if (!thumbnails[gameName]) {
                            thumbnails[gameName] = s.path.replace("../", "");
                        }
                    }
                }
            } catch (e) {
                console.error(`Error while loading thumbnails: ${e}`);
                console.error(`Thumbnails not loaded.`);
            }
        }
        return thumbnails;
    }

    private _initExodosInstalledGamesWatcher(
        platform: GamePlatform,
        exodosPath: string
    ) {
        const gamesPath = path.resolve(
            path.join(exodosPath, platform.gamesDirectory)
        );

        console.log(
            `Initializing installed games watcher with ${gamesPath} path...`
        );
        const t = chokidar.watch;
        const installedGamesWatcher = chokidar.watch(gamesPath, {
            depth: 0,
            persistent: true,
        });

        installedGamesWatcher
            .on("ready", () => {
                console.log("Installed games watcher is ready.");
                installedGamesWatcher
                    .on("addDir", (path) => {
                        console.log(
                            `Game ${path} added, rescan installed games.`
                        );
                        //this.rescanInstalledGamesAndBroadcast(gamesPath);
                        this.setIsInstalledFlag(true, path);
                    })
                    .on("unlinkDir", (path) => {
                        console.log(
                            `Game ${path} has been removed, rescan installed games.`
                        );
                        this.setIsInstalledFlag(false, path);
                        //this.rescanInstalledGamesAndBroadcast(gamesPath);
                    });
                console.log("Initial scan complete. Ready for changes");
            })
            .on("error", (error) => console.log(`Watcher error: ${error}`));
    }

    private setIsInstalledFlag(value: boolean, gamesPath: string) {
        /**
         * XML application path refers to a different folder, but we can predict the real name based on the final segment
         * 
         * e.g
         * gamesPath: eXo/eXoDOS/1Ton
         * xml root: eXo/eXoDOS/!dos/1Ton
         * Capture dirname `1Ton` and compare that instead
         *  */
        
        const dirname = path.basename(gamesPath);
        console.log(
            `Setting installed flag for games in ${gamesPath} to ${value}`
        );
        this._state.platforms.forEach((p) => {
            const game = p.collection.games.find((game) =>
                fixSlashes(game.rootFolder).endsWith(`/${dirname}`) // Cheap but effective matcher
            );
            if (game) {
                console.log(
                    `Setting installed flag for ${game?.title} to ${value}`
                );
                game.installed = value;
                onGameUpdated(game);
            } else {
                console.log('Failed to find matching game');
            }
        });
    }

    private addInstalledGamesPlaylists() {
        for (const platform of this.platforms) { 
            this._state.playlistManager.addInstalledGamesPlaylist(
                platform
            );
        };
    }

    private rescanInstalledGames(gamesPath: string) {
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
            .filter((dirent) => !dirent.name.startsWith("!"))
            .map((dirent) => dirent.name);
        return installedGames;
    }

    private _addInstalledGamesPlaylist(platform: GamePlatform) {
        this._state.playlistManager.addInstalledGamesPlaylist(
            platform
        );
    }
}
