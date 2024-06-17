import { isAnyOf } from '@reduxjs/toolkit';
import { readPlatformsFile } from '@renderer/file/PlatformFile';
import { formatPlatformFileData } from '@renderer/util/LaunchBoxHelper';
import { findGameImageCollection, findGameVideos, initExodosInstalledGamesWatcher, loadGameMedia } from '@renderer/util/images';
import { fixSlashes, removeLowestDirectory } from '@shared/Util';
import { GameParser } from '@shared/game/GameParser';
import { IAdditionalApplicationInfo, IGameInfo } from '@shared/game/interfaces';
import * as fastXmlParser from "fast-xml-parser";
import * as fs from 'fs';
import * as path from 'path';
import { GamesCollection, GamesInitState, initialize, setGames, setLibraries, setRecommended } from './gamesSlice';
import { startAppListening } from './listenerMiddleware';
import { initializeViews } from './searchSlice';

export function addGamesMiddleware() {
  startAppListening({
    matcher: isAnyOf(initialize),
    effect: async (_action, listenerApi) => {
      const state = listenerApi.getState();

      if (state.gamesState.initState === GamesInitState.LOADED) {
        return; // Already loaded
      }

      const startTime = Date.now();
      
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

      let libraries: string[] = [];
      const recommendedIds: Set<string> = new Set();

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

            // Only add to library list if has games
            if (fileCollection.games.length > 0) {
              libraries.push(platform);
            }

            // Load extra game data and add to collection
            for (const game of fileCollection.games) {
              if (game.favorite) {
                recommendedIds.add(game.id);
              }
              loadGameMedia(game, images, videos);
            }
            collection.games.push(...fileCollection.games);
            collection.addApps.push(...fileCollection.additionalApplications);

            // Load Extras add apps
            for (const game of fileCollection.games) {
              collection.addApps.push(...loadDynamicExtrasForGame(game));
            }

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

      console.log(`Load time - ${Date.now() - startTime}ms`);

      // Set collection in state
      libraries = libraries.sort();
      listenerApi.dispatch(setLibraries(libraries));
      listenerApi.dispatch(setRecommended(recommendedIds));
      listenerApi.dispatch(initializeViews(libraries));
      listenerApi.dispatch(setGames(collection));
    }
  });
}

const EXTRAS_DIR = "Extra";

function loadDynamicExtrasForGame(game: IGameInfo): IAdditionalApplicationInfo[] {
  if (!game?.applicationPath)
      throw new Error("Game application path not set. Invalid data.");

  const relativeExtras = path.join(
      fixSlashes(game?.applicationPath),
      EXTRAS_DIR
  );
  const gameExtrasPath = path.join(
      window.External.config.fullExodosPath,
      relativeExtras
  );

  const addApps: IAdditionalApplicationInfo[] = [];

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
      for (const file of files.filter((f) => !ignoredExtensions.includes(f.split(".")?.[1] ?? ""))) {
        const name = file.split(".")[0];
        const id = getExtrasId(game.id, file);
        addApps.push({
            applicationPath: path.join(relativeExtras, file),
            autoRunBefore: false,
            gameId: game.id,
            id,
            launchCommand: ``,
            name,
            waitForExit: false,
        });
      }
  } catch (e) {
      console.error(
          `Error while reading extras directory: ${gameExtrasPath} Error: ${e}`
      );
      return [];
  }

  return addApps;
}

function getExtrasId(gameId: string, filename: string): string {
  return `${gameId}-${filename}`;
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
