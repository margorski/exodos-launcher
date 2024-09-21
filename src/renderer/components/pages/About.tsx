import { UpdateInfo } from "electron-updater";
import * as React from "react";
import { ExodosBackendInfo } from "@shared/interfaces";
import { app } from "@electron/remote";

type OwnProps = {
    /** Whether an update is available to the Launcher */
    updateInfo: UpdateInfo | undefined;
    /** Callback to initiate the update */
    exodosBackendInfo: ExodosBackendInfo | undefined;
};

export type AboutPageProps = OwnProps;

export function AboutPage(props: AboutPageProps) {
    const renderedGreetings = React.useMemo(
        () => (
            <div className="home-page__box">
                <div className="home-page__box-head">Welcome to eXoDOS!</div>
                <div className="home-page__box-body">
                    <p>
                        This pack includes 7,200 DOS games. The games have
                        already been configured to run in DOSBox. Games which
                        are supported by ScummVM will give you the option at
                        launch as to which emulator you would like to use.
                    </p>
                    <br />
                    <p>
                        If you have not already done so, run the utilities in
                        the Setup box to install the collection on your
                        computer. Then, click on the MS-DOS tab to browse
                        through and play the games, or the DOS Magazines tab to
                        read magazines.
                    </p>
                </div>
            </div>
        ),
        []
    );

    const renderedHeader = () => (
        <div className="home-page__two_columns_container">
            <div className="home-page__header">
                <div className="">
                    <div>
                        <h1>eXoDOS v5</h1>
                    </div>
                    <div>
                        <h4>{`backend: ${
                            props.exodosBackendInfo
                                ? props.exodosBackendInfo.version
                                : ""
                        }`}</h4>
                    </div>
                    <div>
                        <h4>{`exogui: ${app.getVersion()}`}</h4>
                    </div>
                </div>
                <div className="home-page__subheader">
                    {link("Website", "https://www.retro-exo.com/exodos.html")}|
                    {link("Discord", "https://discord.gg/SaMKayf")}
                </div>
            </div>
            {/* Logo */}
            <div className="home-page__logo">
                <img src="images/logo.png" />
            </div>
        </div>
    );

    const link = (title: string, url: string): JSX.Element => {
        return (
            <a href={url} title={url}>
                {title}
            </a>
        );
    };

    // Render
    return (
        <div className="home-page simple-scroll">
            <div className="home-page__inner">
                {renderedHeader()}
                {renderedGreetings}
            </div>
        </div>
    );
}
