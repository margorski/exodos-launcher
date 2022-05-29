import * as electron from "electron";
import { OpenDialogOptions } from "electron";
import * as path from "path";
import { SharedSocket } from "@shared/back/SharedSocket";
import {
  BackIn,
  BackOut,
  GetRendererInitDataResponse,
  OpenDialogData,
  OpenDialogResponseData,
  OpenExternalData,
  OpenExternalResponseData,
  WrappedResponse,
} from "@shared/back/types";
import { InitRendererChannel, InitRendererData } from "@shared/IPC";
import { setTheme } from "@shared/Theme";
import { createErrorProxy } from "@shared/Util";
import { isDev } from "./Util";
import { app, BrowserWindow, dialog, shell } from "@electron/remote";

/**
 * Object with functions that bridge between this and the Main processes
 * (Note: This is mostly a left-over from when "node integration" was disabled.
 *        It might be a good idea to move this to the Renderer?)
 */
window.External = {
  installed: createErrorProxy("installed"),

  version: createErrorProxy("version"),

  platform: (process.platform + "") as NodeJS.Platform, // (Coerce to string to make sure its not a remote object)

  minimize() {
    const currentWindow = BrowserWindow.getFocusedWindow();
    currentWindow?.minimize();
  },

  maximize() {
    const currentWindow = BrowserWindow.getFocusedWindow();
    if (currentWindow?.isMaximized()) {
      currentWindow.unmaximize();
    } else {
      currentWindow?.maximize();
    }
  },

  close() {
    const currentWindow = BrowserWindow.getFocusedWindow();
    currentWindow?.close();
  },

  restart() {
    app.relaunch();
    app.quit();
  },

  showOpenDialogSync(options: OpenDialogOptions): string[] | undefined {
    // @HACK: Electron set the incorrect return type for "showOpenDialogSync".
    return dialog.showOpenDialogSync(options) as any;
  },

  toggleDevtools(): void {
    BrowserWindow.getFocusedWindow()?.webContents.toggleDevTools();
  },

  preferences: {
    data: createErrorProxy("preferences.data"),
    onUpdate: undefined,
  },

  config: createErrorProxy("config"),

  log: {
    entries: [],
    offset: 0,
  },

  services: createErrorProxy("services"),

  isDev,

  isBackRemote: createErrorProxy("isBackRemote"),

  back: new SharedSocket(WebSocket),

  fileServerPort: -1,

  backUrl: createErrorProxy("backUrl"),

  initialLang: createErrorProxy("initialLang"),
  initialLangList: createErrorProxy("initialLangList"),
  initialThemes: createErrorProxy("initialThemes"),
  initialPlaylists: createErrorProxy("initialPlaylists"),
  initialPlatforms: createErrorProxy("initialPlatforms"),
  initialLocaleCode: createErrorProxy("initialLocaleCode"),

  waitUntilInitialized() {
    if (!isInitDone) {
      return onInit;
    }
  },
};

let isInitDone: boolean = false;
const onInit = (async () => {
  // Fetch data from main process
  const data: InitRendererData =
    electron.ipcRenderer.sendSync(InitRendererChannel);
  // Store value(s)
  window.External.installed = data.installed;
  window.External.version = data.version;
  window.External.isBackRemote = data.isBackRemote;
  window.External.backUrl = new URL(data.host);
  // Connect to the back
  const socket = await SharedSocket.connect(WebSocket, data.host, data.secret);
  window.External.back.url = data.host;
  window.External.back.secret = data.secret;
  window.External.back.setSocket(socket);
})()
  .then(
    () =>
      new Promise((resolve, reject) => {
        window.External.back.on("message", onMessage);
        // Fetch the config and preferences
        window.External.back.send<GetRendererInitDataResponse>(
          BackIn.GET_RENDERER_INIT_DATA,
          undefined,
          (response) => {
            if (response.data) {
              window.External.preferences.data = response.data.preferences;
              window.External.config = {
                data: response.data.config,
                // @FIXTHIS This should take if this is installed into account
                fullExodosPath: path.resolve(response.data.config.exodosPath),
                fullJsonFolderPath: path.resolve(
                  response.data.config.exodosPath,
                  response.data.config.jsonFolderPath
                ),
              };
              window.External.fileServerPort = response.data.fileServerPort;
              window.External.log.entries = response.data.log;
              window.External.services = response.data.services;
              window.External.initialLang = response.data.language;
              window.External.initialLangList = response.data.languages;
              window.External.initialThemes = response.data.themes;
              window.External.initialPlaylists = response.data.playlists;
              window.External.initialPlatforms = response.data.platforms;
              window.External.initialLocaleCode = response.data.localeCode;
              if (window.External.preferences.data.currentTheme) {
                setTheme(window.External.preferences.data.currentTheme);
              }
              resolve(null);
            } else {
              reject(
                new Error(
                  '"Get Renderer Init Data" response does not contain any data.'
                )
              );
            }
          }
        );
      })
  )
  .then(() => {
    isInitDone = true;
  });

function onMessage(this: WebSocket, res: WrappedResponse): void {
  switch (res.type) {
    case BackOut.UPDATE_PREFERENCES_RESPONSE:
      {
        window.External.preferences.data = res.data;
      }
      break;

    case BackOut.OPEN_DIALOG:
      {
        const resData: OpenDialogData = res.data;
        dialog.showMessageBox(resData).then((r) => {
          window.External.back.sendReq<any, OpenDialogResponseData>({
            id: res.id,
            type: BackIn.GENERIC_RESPONSE,
            data: r.response,
          });
        });
      }
      break;

    case BackOut.OPEN_EXTERNAL:
      {
        const resData: OpenExternalData = res.data;

        shell
          .openExternal(resData.url, resData.options)
          .then(() => {
            window.External.back.sendReq<OpenExternalResponseData>({
              id: res.id,
              type: BackIn.GENERIC_RESPONSE,
              data: {},
            });
          })
          .catch((error) => {
            window.External.back.sendReq<OpenExternalResponseData>({
              id: res.id,
              type: BackIn.GENERIC_RESPONSE,
              data: { error },
            });
          });
      }
      break;
  }
}
