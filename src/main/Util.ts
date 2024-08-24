import * as child_process from "child_process";
import { app, BrowserWindow, Menu, MenuItemConstructorOptions } from "electron";
import * as path from "path";
import * as util from "util";

const execFile = util.promisify(child_process.execFile);

/**
 * Check if an application is installed
 * @param binaryName The command you would use the run an application command
 * @param argument An argument to pass the command. This argument should not cause any side effects. By default --version
 */
export async function isInstalled(
    binaryName: string,
    argument = "--version",
): Promise<boolean> {
    try {
        await execFile(binaryName, [argument]);
    } catch (e) {
        return false;
    }
    return true;
}

/**
 * If Electron is in development mode (or in release mode)
 * (This is copied straight out of the npm package 'electron-is-dev')
 */
export const isDev: boolean = (function () {
    const getFromEnv = parseInt(process.env.ELECTRON_IS_DEV || "", 10) === 1;
    const isEnvSet = "ELECTRON_IS_DEV" in process.env;
    return isEnvSet
        ? getFromEnv
        : process.defaultApp ||
              /node_modules[\\/]electron[\\/]/.test(process.execPath);
})();

/**
 * Get the path of the folder containing the config and preferences files.
 * @param installed If the application is installed (instead of portable).
 */
export function getMainFolderPath(): string {
    return process.env.APPIMAGE ?
        app.getPath('appData') :
        process.cwd();
}

/** Open a context menu, built from the specified template. */
export function openContextMenu(template: MenuItemConstructorOptions[]): Menu {
    const menu = Menu.buildFromTemplate(template);
    const window = BrowserWindow.getFocusedWindow();
    if (!window) {
        throw Error("Browser window not initialized.");
    }
    menu.popup({ window: window });
    return menu;
}
