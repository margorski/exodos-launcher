import * as fs from "fs";
import { GamePlaylistContent, GamePlaylistEntry } from "@shared/interfaces";
import { Coerce } from "@shared/utils/Coerce";
import { IObjectParserProp, ObjectParser } from "@shared/utils/ObjectParser";
import * as fastXmlParser from "fast-xml-parser";

const { str } = Coerce;

export namespace PlaylistFile {
    /**
     * Read and parse the file asynchronously.
     * @param filePath Path of the file.
     * @param onError Called for each error that occurs while parsing.
     */
    export function readFile(
        filePath: string,
        onError?: (error: string) => void
    ): Promise<GamePlaylistContent> {
        return new Promise((resolve, reject) => {
            fs.readFile(filePath, (error, data) => {
                if (error) {
                    reject(error);
                } else {
                    let parsed: any;
                    try {
                        //  parsed = JSON.parse(data.toString());
                        parsed = fastXmlParser.parse(data.toString(), {
                            ignoreAttributes: true,
                            ignoreNameSpace: true,
                            parseNodeValue: true,
                            parseAttributeValue: false,
                            parseTrueNumberOnly: true,
                            // @TODO Look into which settings are most appropriate
                        });
                    } catch {
                        parsed = {};
                    }
                    resolve(parseGamePlaylist(parsed.LaunchBox || {}));
                }
            });
        });
    }

    function parseGamePlaylist(
        data: any,
        onError?: (error: string) => void
    ): GamePlaylistContent {
        const playlist: GamePlaylistContent = {
            games: [],
            title: "",
            description: "",
            author: "",
            icon: undefined,
            library: undefined,
        };

        const playlistInfo = data && data.Playlist ? data.Playlist : {};
        const playlistGames = data.PlaylistGame
            ? Array.isArray(data.PlaylistGame)
                ? data.PlaylistGame
                : [data.PlaylistGame]
            : [];
        const intermediatePlaylistFormat = {
            title: playlistInfo.Name,
            description: playlistInfo.Notes,
            author: "",
            icon: "",
            library: "",
            games: playlistGames.map((game: any) => {
                return {
                    id: game.GameId,
                    title: game.GameTitle,
                    platform: game.GamePlatform,
                };
            }),
        };

        const parser = new ObjectParser({
            input: intermediatePlaylistFormat,
            onError:
                onError &&
                ((e) =>
                    onError(
                        `Error while converting Playlist: ${e.toString()}`
                    )),
        });
        parser.prop("title", (v) => (playlist.title = str(v)));
        parser.prop("description", (v) => (playlist.description = str(v)));
        parser.prop("author", (v) => (playlist.author = str(v)));
        parser.prop("icon", (v) => (playlist.icon = str(v)), true);
        parser.prop("library", (v) => (playlist.library = str(v)), true);
        parser.prop("games").array((item) => {
            playlist.games.push(parseGamePlaylistEntry(item));
        });

        // When playlist library is not set, deduce it from the games.
        if (!playlist.library) {
            const gameDeductedPlatform = playlist.games.find(
                (g) => !!g.platform
            )?.platform;
            if (gameDeductedPlatform)
                playlist.library = `${gameDeductedPlatform}.xml`;
        }
        return playlist;
    }

    function parseGamePlaylistEntry(
        parser: IObjectParserProp<any>
    ): GamePlaylistEntry {
        let parsed: GamePlaylistEntry = {
            id: "",
            platform: "",
            title: "",
        };
        parser.prop("id", (v) => (parsed.id = str(v)));
        parser.prop("title", (v) => (parsed.title = str(v)));
        parser.prop("platform", (v) => (parsed.platform = str(v)));
        return parsed;
    }
}
