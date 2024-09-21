import { BrowserWindow } from "@electron/remote";
import { getFileServerURL } from "@shared/Util";

export type OpenHtmlOpts = {
    url: string;
    title: string;
};

export function openHtmlInNewWindow(opts: OpenHtmlOpts) {
    const { url, title } = opts;
    console.log(url);
    console.log(getFileServerURL());
    const win = new BrowserWindow({
        show: false,
        title,
        resizable: false,
        width: 800,
        height: 600,
    });
    win.setMenuBarVisibility(false);
    win.loadURL(url);
    win.once("ready-to-show", () => {
        win.show();
        win.focus();
    });
}
