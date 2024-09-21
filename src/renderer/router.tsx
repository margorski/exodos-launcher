import { BrowsePageLayout } from "@shared/BrowsePageLayout";
import { Theme } from "@shared/ThemeFile";
import { ExodosBackendInfo, GamePlaylist } from "@shared/interfaces";
import { UpdateInfo } from "electron-updater";
import * as React from "react";
import { Route, Routes } from "react-router-dom";
import { Paths } from "./Paths";
import { GameOrderChangeEvent } from "./components/GameOrder";
import BrowsePage, { BrowsePageProps } from "./components/pages/BrowsePage";
import { NotFoundPage } from "./components/pages/NotFoundPage";
import {
    ConnectedConfigPage,
    ConnectedConfigPageProps,
} from "./containers/ConnectedConfigPage";
import {
    ConnectedHomePage,
    ConnectedHomePageProps,
} from "./containers/ConnectedHomePage";
import { ConnectedLogsPage } from "./containers/ConnectedLogsPage";
import { HomePage } from "./components/pages/HomePage";
import { AboutPage, AboutPageProps } from "./components/pages/About";

export type AppRouterProps = {
    gamesTotal: number;
    playlists: GamePlaylist[];
    appPaths: Record<string, string>;
    onLaunchGame: (gameId: string) => void;
    playlistIconCache: Record<string, string>;
    libraries: string[];
    localeCode: string;

    order?: GameOrderChangeEvent;
    gameScale: number;
    gameLayout: BrowsePageLayout;
    wasNewGameClicked: boolean;
    gameLibrary: string;
    themeList: Theme[];
    updateInfo: UpdateInfo | undefined;
    exodosBackendInfo: ExodosBackendInfo | undefined;
    currentGameRefreshKey: number;
};

export class AppRouter extends React.Component<AppRouterProps> {
    render() {
        const aboutProps: AboutPageProps = {
            exodosBackendInfo: this.props.exodosBackendInfo,
            updateInfo: this.props.updateInfo,
        };
        const browseProps: BrowsePageProps = {
            playlists: this.props.playlists,
            playlistIconCache: this.props.playlistIconCache,
            order: this.props.order,
            gameScale: this.props.gameScale,
            gameLayout: this.props.gameLayout,
            gameLibrary: this.props.gameLibrary,
            refreshKey: this.props.currentGameRefreshKey,
        };
        const configProps: ConnectedConfigPageProps = {
            themeList: this.props.themeList,
            platforms: this.props.libraries,
            localeCode: this.props.localeCode,
        };
        return (
            <Routes>
                <Route
                    path={Paths.HOME}
                    element={<BrowsePage {...browseProps} />}
                />
                <Route
                    path={Paths.BROWSE}
                    element={<BrowsePage {...browseProps} />}
                />
                <Route path={Paths.LOGS} element={<ConnectedLogsPage />} />
                <Route
                    path={Paths.CONFIG}
                    element={<ConnectedConfigPage {...configProps} />}
                />
                <Route
                    path={Paths.ABOUT}
                    element={<AboutPage {...aboutProps} />}
                />
                <Route Component={NotFoundPage} />
            </Routes>
        );
    }
}
