import * as React from "react";
import { IAdditionalApplicationInfo } from "@shared/game/interfaces";
import { LangContainer } from "@shared/lang";
import { LangContext } from "../util/lang";
import { InputField } from "./InputField";

export type RightBrowseSidebarAddAppProps = {
    /** Additional Application to show and edit */
    addApp: IAdditionalApplicationInfo;
    onLaunch?: (addApp: IAdditionalApplicationInfo) => void;
};

export interface RightBrowseSidebarAddApp {
    context: LangContainer;
}

/** Displays an additional application for a game in the right sidebar of BrowsePage. */
export class RightBrowseSidebarAddApp extends React.Component<RightBrowseSidebarAddAppProps> {
    render() {
        const strings = this.context.browse;
        const { addApp } = this.props;
        return (
            <div className="browse-right-sidebar__additional-application">
                {/* Title & Launch Button */}
                <div className="browse-right-sidebar__row browse-right-sidebar__row--additional-applications-name">
                    <InputField
                        text={addApp.name}
                        placeholder={strings.noName}
                    />
                    <input
                        type="button"
                        className="simple-button"
                        value={strings.launch}
                        onClick={this.onLaunchClick}
                    />
                </div>
            </div>
        );
    }

    onLaunchClick = (): void => {
        if (this.props.onLaunch) {
            this.props.onLaunch(this.props.addApp);
        }
    };

    static contextType = LangContext;
}
