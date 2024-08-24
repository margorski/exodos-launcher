import * as fs from "fs";
import * as path from "path";

import { PlaylistFile } from "./PlaylistFile";
import { LogFunc } from "@back/types";
import { GamePlaylist } from "@shared/interfaces";

export type PlaylistUpdatedFunc = (playlist: GamePlaylist) => void;
export interface PlaylistManagerOpts {
    playlistFolder: string;
    log: LogFunc;
    onPlaylistAddOrUpdate: PlaylistUpdatedFunc;
}

export class PlaylistManager {
    private _initialized = false;

    public readonly playlists: GamePlaylist[] = [];

    async init(opts: PlaylistManagerOpts) {
        if (this._initialized) {
            console.log("PlaylistManager already initialized. Leaving.");
            return;
        }

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

            playlist = {
                ...data,
                filename,
            };
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
