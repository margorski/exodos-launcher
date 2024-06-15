import { isAnyOf } from '@reduxjs/toolkit';
import { readPlatformsFile } from '@renderer/file/PlatformFile';
import * as fastXmlParser from "fast-xml-parser";
import * as fs from 'fs';
import * as path from 'path';
import { GamesCollection, GamesInitState, initialize, setGames } from './gamesSlice';
import { startAppListening } from './listenerMiddleware';
import { formatPlatformFileData } from '@renderer/util/LaunchBoxHelper';
import { GameParser } from '@shared/game/GameParser';
import { findGameImageCollection, findGameVideos, initExodosInstalledGamesWatcher, loadGameMedia } from '@renderer/util/images';
import { removeLowestDirectory } from '@shared/Util';

export function addGamesMiddleware() {
  startAppListening({
    matcher: isAnyOf(initialize),
    effect: async (_action, listenerApi) => {
      const state = listenerApi.getState();

      if (state.gamesState.initState > GamesInitState.WAITING) {
        return; // Already loading
      }
      
      // Do load

      const collection: GamesCollection = {
        games: [],
        addApps: [],
      };

      const platformsPath = path.join(
        window.External.config.fullExodosPath,
        window.External.config.data.platformFolderPath
      );

      const platformsFile = await readPlatformsFile(
        path.join(platformsPath, "../Platforms.xml")
      );

      // Load each platforms games into the collection
      for (const platform of platformsFile.platforms) {
        console.log(`Loading platform ${platform} from ${platformsPath}`);

        try {
          console.log(`Checking existence of platform ${platform} xml file..`);
          const platformFile = path.join(platformsPath, `${platform}.xml`);
          if ((await fs.promises.stat(platformFile)).isFile()) {
            console.log(`Platform file found: ${platformFile}`);

            const content = await fs.promises.readFile(platformFile, { encoding: 'utf-8' });

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

            if (!formatPlatformFileData(data)) {
                throw new Error(
                    `Failed to parse XML file: ${platformFile}`
                );
            }

            // Load images ahead of time

            const imagesRoot = path.join(window.External.config.fullExodosPath, window.External.config.data.imageFolderPath, platform);
            const videoRoot = path.join(window.External.config.fullExodosPath, "Videos", platform);
            const images = await findGameImageCollection(imagesRoot);
            const videos = findGameVideos(videoRoot);
            
            // Load games
            const fileCollection = GameParser.parse(data, platform, window.External.config.fullExodosPath);

            for (const game of fileCollection.games) {
              loadGameMedia(game, images, videos);
            }
            collection.games.push(...fileCollection.games);
            collection.addApps.push(...fileCollection.additionalApplications);

            // Create a watcher for this platform

            // If this platform has games, then start a watcher to update their install state
            if (fileCollection.games.length > 0) {
              const gameDirectory = removeLowestDirectory(fileCollection.games[0].rootFolder, 2);
              initExodosInstalledGamesWatcher(path.join(window.External.config.fullExodosPath, gameDirectory));
            }

            // Success!
          } else {
            console.log(`Platform file not found: ${platformFile}`);
          }
        } catch (error) {
          console.error(`Failed to load Platform "${platform}": ${error}`);
        }
      }

      // Set collection in state
      listenerApi.dispatch(setGames(collection));
    }
  });
}

export type ErrorCopy = {
  columnNumber?: number;
  fileName?: string;
  lineNumber?: number;
  message: string;
  name: string;
  stack?: string;
};

export type LoadPlatformError = ErrorCopy & {
  /** File path of the platform file the error is related to. */
  filePath: string;
};
