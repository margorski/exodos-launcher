import { GameParser } from "@shared/game/GameParser";
import { IGameInfo } from "@shared/game/interfaces";
import { GamePlatform, IThumbnailsInfo } from "@shared/platform/interfaces";
import * as fastXmlParser from "fast-xml-parser";
import * as fs from "fs";
import * as path from "path";
import { promisify } from "util";
import { copyError } from "../util/misc";
import { GameManagerState, LoadPlatformError } from "./types";
import { EXODOS_GAMES_PLATFORM_NAME } from "@shared/constants";
import {
    PlaylistManager,
    PlaylistUpdatedFunc,
} from "@back/playlist/PlaylistManager";
import * as LaunchBoxHelper from "./LaunchBoxHelper";
import { LogFunc } from "@back/types";
import { FolderWatcher } from "@back/util/FolderWatcher";
import { GamePlaylistEntry } from "@shared/interfaces";

const readdir = promisify(fs.readdir);
const readFile = promisify(fs.readFile);
const stat = promisify(fs.stat);

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

    public get dosPlatform() {
        return this._state.platforms.find(
            (p) => p.name === EXODOS_GAMES_PLATFORM_NAME
        );
    }

    public async init(opts: IGameManagerOpts) {
        await this._state.playlistManager.init({
            ...opts,
        });
        const platformErrors = await this.loadPlatforms(
            opts.platformsPath,
            opts.thumbnails
        );
        this.initExodosInstalledGamesWatcher(opts.exodosPath);

        return platformErrors;
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
                        platforms.push({
                            name: path.basename(platformFile, platformFileExt),
                            filePath: platformFile,
                            library: libraryName,
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

    private initExodosInstalledGamesWatcher(exodosPath: string) {
        const gamesPath = path.resolve(path.join(exodosPath, "eXo/eXoDOS/"));

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
                        console.log(
                            `Game ${path} added, rescan installed games.`
                        );
                        this.rescanInstalledGamesAndBroadcast(gamesPath);
                    })
                    .on("remove", (path) => {
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
        this.addInstalledGamesPlaylist();
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
            .filter((dirent) => dirent.name !== `!dos`)
            .map((dirent) => dirent.name);
        return installedGames;
    }

    private addInstalledGamesPlaylist() {
        const dosPlatform = this.dosPlatform;
        if (!dosPlatform) {
            console.log(
                "Cannot create installed game playlist. MS-DOS platform not loaded yet."
            );
            return;
        }
        const dosPlatformInstalledGames = this._state.installedGames
            .map((gameName) => {
                const gameInPlatform = dosPlatform.collection.games.find(
                    (game) =>
                        game.applicationPath.split("\\").includes(gameName)
                );
                if (gameInPlatform) return { id: gameInPlatform.id };
                else return;
            })
            .filter((g) => g) as GamePlaylistEntry[];
        this._state.playlistManager.addInstalledGamesPlaylist(
            dosPlatformInstalledGames
        );
    }

    public findPlatformByName(name: string): GamePlatform | undefined {
        return this._state.platforms.find((p) => p.name === name);
    }

    /** (Similar to Array.find(), but it looks through all platforms) */
    public findGame(
        predicate: (this: undefined, game: IGameInfo, index: number) => boolean
    ): IGameInfo | undefined {
        for (let i = 0; i < this._state.platforms.length; i++) {
            const game =
                this._state.platforms[i].collection.games.find(predicate);
            if (game) {
                return game;
            }
        }
    }
}
