import * as fs from "fs";
import * as path from "path";

import { PlaylistFile } from "./PlaylistFile";
import { LogFunc } from "@back/types";
import { GamePlaylist, GamePlaylistEntry } from "@shared/interfaces";
import { GamePlatform } from "@shared/platform/interfaces";
import { INSTALLED_GAMES_PLAYLIST_PREFIX } from "@shared/game/GameFilter";

export type PlaylistUpdatedFunc = (playlist: GamePlaylist) => void;
export interface PlaylistManagerOpts {
    playlistFolder: string;
    log: LogFunc;
    onPlaylistAddOrUpdate: PlaylistUpdatedFunc;
}

export class PlaylistManager {
    private _initialized = false;
    private _opts?: PlaylistManagerOpts;

    public readonly playlists: GamePlaylist[] = [];

    async init(opts: PlaylistManagerOpts) {
        if (this._initialized) {
            console.log("PlaylistManager already initialized. Leaving.");
            return;
        }
        this._opts = opts;

        console.log("Loading playlists...");
        try {
            const playlistFiles = (
                await fs.promises.readdir(opts.playlistFolder, {
                    withFileTypes: true,
                })
            )
                .filter(
                    (dirent) =>
                        dirent.isFile() &&
                        !dirent.name.toLowerCase().startsWith("installed") &&
                        dirent.name.endsWith(".xml")
                )
                .map((dirent) => dirent.name);
            console.log(`Found ${playlistFiles.length} playlists`);
            playlistFiles.forEach((pf) =>
                this._onPlaylistAddOrChange(pf, opts)
            );
            this._initialized = true;
        } catch (error) {
            opts.log({
                source: "Back",
                content: `Error while loading playlist files. Error: ${error}`,
            });
        }
    }

    public addInstalledGamesPlaylist(
        platform: GamePlatform
    ) {
        if (!this._initialized) {
            console.log("PlaylistManager not initialized. Leaving");
            return;
        }

        if (!platform.isGamePlatform) {
            console.log(
                `Platform ${platform.name} is not a game platform. Doesn't need installed games playlist.`
            );
            return;
        }

        // Add a stub playlist for installed games, we'll use special behaviour when reading later
        this.playlists.unshift({
            title: `Installed games (${platform.name})`,
            description: "A list of installed games.",
            author: "",
            icon: "",
            library: platform.name,
            filename: `${INSTALLED_GAMES_PLAYLIST_PREFIX}_${platform.name}`,
            games: [],
        });
    }

    private async _onPlaylistAddOrChange(
        filename: string,
        opts: PlaylistManagerOpts
    ) {
        console.log("Playlist added or changed: " + filename);

        const filePath = path.join(opts.playlistFolder, filename);
        let playlist: GamePlaylist | undefined;
        try {
            const data = await PlaylistFile.readFile(filePath, (error) =>
                opts.log({
                    source: "Playlist",
                    content: `Error while parsing playlist "${filePath}". ${error}`,
                })
            );

            const hasGames =
                data.games &&
                Array.isArray(data.games) &&
                data.games.length > 0;
            if (hasGames) {
                const gamesPlatform =
                    data.library ?? data.games[0].platform ?? "";
                if (gamesPlatform === "") {
                    opts.log({
                        source: "Playlist",
                        content: `Playlist "${filePath}" doesn't have a library. Skipping.`,
                    });
                } else {
                    playlist = {
                        ...data,
                        library: gamesPlatform.slice(0, -4),
                        filename,
                    };
                }
            } else {
                opts.log({
                    source: "Playlist",
                    content: `Playlist "${filePath}" doesn't have games. Skipping.`,
                });
            }
        } catch (error) {
            opts.log({
                source: "Playlist",
                content: `Failed to load playlist "${filePath}". ${error}`,
            });
        }
        // Add or update playlist
        if (playlist) {
            console.log(`Playlist is valid`);
            const index = this.playlists.findIndex(
                (p) => p.filename === filename
            );
            if (index >= 0) {
                console.log(`Playlist exists, updating.`);
                this.playlists[index] = playlist;
            } else {
                console.log(`Adding new playlist: ${playlist.filename}`);
                this.playlists.push(playlist);
            }
            opts.onPlaylistAddOrUpdate(playlist);
        }
    }
}
