import { GameParser } from "@shared/game/GameParser";
import { IAdditionalApplicationInfo, IGameInfo } from "@shared/game/interfaces";
import { GamePlatform, IThumbnailsInfo } from "@shared/platform/interfaces";
import * as fastXmlParser from "fast-xml-parser";
import * as fs from "fs";
import * as path from "path";
import * as chokidar from "chokidar";
import { promisify } from "util";
import { copyError } from "../util/misc";
import { GameManagerState, LoadPlatformError } from "./types";
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
import { ViewGame } from "@shared/back/types";
import { platformConfigs } from "@back/platform/platformConfig";

const readdir = promisify(fs.readdir);
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
    thumbnails: IThumbnailsInfo[];
    onPlaylistAddOrUpdate: PlaylistUpdatedFunc;
    log: LogFunc;
}

export class GameManager {
    private _state: GameManagerState = {
        platforms: [],
        platformsPath: "",
        installedGames: [],
        playlistManager: new PlaylistManager(),
    };

    public get platforms() {
        return this._state.platforms;
    }

    public get playlists() {
        return this._state.playlistManager.playlists;
    }

    public async init(opts: IGameManagerOpts) {
        await this._state.playlistManager.init({
            ...opts,
        });
        const platformErrors = await this.loadPlatforms(
            opts.platformsPath,
            opts.thumbnails
        );
        this.platforms
            .filter((p) => p.configuration?.gamesPlatform)
            .forEach((p) =>
                this._initExodosInstalledGamesWatcher(p, opts.exodosPath)
            );

        return platformErrors;
    }

    public findPlatformByName(name: string): GamePlatform | undefined {
        return this._state.platforms.find((p) => p.name === name);
    }

    public searchGames(opts: SearchGamesOpts): IGameInfo[] {
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

    public queryGames(query: BackQuery): BackQueryCache {
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

    public findGame(gameId: string): IGameInfo | undefined {
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

    public findAddApps(gameId: string): IAdditionalApplicationInfo[] {
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

    public countGames(): number {
        let count = 0;
        const platforms = this.platforms;
        for (let i = 0; i < platforms.length; i++) {
            count += platforms[i].collection.games.length;
        }
        return count;
    }

    private async loadPlatforms(
        platformsPath: string,
        images: IThumbnailsInfo[]
    ): Promise<LoadPlatformError[]> {
        this._state.platformsPath = platformsPath;
        const platforms: GamePlatform[] = [];
        try {
            const libraryNames = await readdir(this._state.platformsPath);
            for (let libraryName of libraryNames) {
                // Check each library for platforms
                try {
                    const platformFile = path.join(
                        this._state.platformsPath,
                        libraryName
                    );
                    const platformFileExt = path.extname(platformFile);
                    if (
                        platformFileExt.toLowerCase().endsWith(".xml") &&
                        (await stat(platformFile)).isFile()
                    ) {
                        const name = path.basename(
                            platformFile,
                            platformFileExt
                        );
                        platforms.push({
                            name: name,
                            filePath: platformFile,
                            library: libraryName,
                            configuration: platformConfigs.find(
                                (p) => p.filename === name
                            ),
                            data: {
                                LaunchBox: {
                                    Game: [],
                                    AdditionalApplication: [],
                                },
                            },
                            collection: {
                                games: [],
                                additionalApplications: [],
                            },
                        });
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

                    // Populate platform
                    platform.data = data;
                    platform.collection = GameParser.parse(
                        data,
                        platform.library
                    );
                    platform.collection.games.forEach((g) => {
                        const imagesForGame = images.find(
                            (i) => i.GameName == g.title
                        );
                        if (imagesForGame)
                            g.thumbnailPath = imagesForGame.BoxThumbnail;
                    });
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

    private _initExodosInstalledGamesWatcher(
        platform: GamePlatform,
        exodosPath: string
    ) {
        const gamesPath = path.resolve(
            path.join(
                exodosPath,
                `eXo/${platform.configuration?.gamesSubdirectory}/`
            )
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
                        this.rescanInstalledGamesAndBroadcast(gamesPath);
                    })
                    .on("unlinkDir", (path) => {
                        console.log(
                            `Game ${path} has been removed, rescan installed games.`
                        );
                        this.rescanInstalledGamesAndBroadcast(gamesPath);
                    });
                this.rescanInstalledGamesAndBroadcast(gamesPath);
                console.log("Initial scan complete. Ready for changes");
            })
            .on("error", (error) => console.log(`Watcher error: ${error}`));
    }

    private rescanInstalledGamesAndBroadcast(gamesPath: string) {
        this._state.installedGames = this.rescanInstalledGames(gamesPath);
        this.platforms
            .filter((p) => p.configuration?.gamesPlatform)
            .forEach((p) => this._addInstalledGamesPlaylist(p));
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
        const platformInstalledGames = this._state.installedGames
            .map((gameName) => {
                const gameInPlatform = platform.collection.games.find((game) =>
                    game.applicationPath.split("\\").includes(gameName)
                );
                if (gameInPlatform) return { id: gameInPlatform.id };
                else return;
            })
            .filter((g) => g) as GamePlaylistEntry[];
        this._state.playlistManager.addInstalledGamesPlaylist(
            platformInstalledGames,
            platform
        );
    }
}
