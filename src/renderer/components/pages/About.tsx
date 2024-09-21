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

const discordlink = "https://discord.gg/37FYaUZ";
const exoguiRepoLink = "https://github.com/margorski/exodos-launcher";
const links = [
    "https://www.retro-exo.com",
    "https://github.com/exoscoriae",
    discordlink,
];

const link = (title: string, url: string): JSX.Element => {
    return (
        <a href={url} title={url} target="_blank">
            {title}
        </a>
    );
};

export function AboutPage(props: AboutPageProps) {
    // Render
    return (
        <div className="about-page simple-scroll">
            <div className="about-page__content">
                <p className="about-page__header">exogui</p>
                <p> {`Version ${app.getVersion()}`}</p>
                {link(exoguiRepoLink, exoguiRepoLink)}
                <p>exogui is the official Linux frontend for eXo projects.</p>
                <p>Currently maintained by Jelcynek and Colin.</p>
                <br />
                <p>eXo Project Links:</p>
                <ul className="about-page__links-list">
                    {links.map((l) => (
                        <li key={l}>{link(l, l)}</li>
                    ))}
                </ul>
                <br />
                <p>Thanks to eXo and his team for developing the projects.</p>
                <p>Linux backend maintainer: parric</p>
                <br />
                <p>
                    Want to help? Volunteer in the{" "}
                    {link("Discord", discordlink)}.
                </p>
            </div>
        </div>
    );
}
