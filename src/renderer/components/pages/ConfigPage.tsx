import * as React from "react";
import { WithPreferencesProps } from "@renderer/containers/withPreferences";
import { BackIn, UpdateConfigData } from "@shared/back/types";
import { updatePreferencesData } from "@shared/preferences/util";
import { Theme } from "@shared/ThemeFile";
import { isExodosValidCheck } from "../../Util";
import { CheckBox } from "../CheckBox";
import { ConfigExodosPathInput } from "../ConfigExodosPathInput";
import { Dropdown } from "../Dropdown";
import { DropdownInputField } from "../DropdownInputField";
import { englishTranslation } from "@renderer/lang/en";
type OwnProps = {
    /** List of all platforms */
    platforms: string[];
    /** Filenames of all files in the themes folder. */
    themeList: Theme[];
    localeCode: string;
};

export type ConfigPageProps = OwnProps & WithPreferencesProps;

type ConfigPageState = {
    /** If the currently entered Exodos path points to a "valid" Exodos folder (it exists and "looks" like a Exodos folder). */
    isExodosPathValid?: boolean;
    /** Currently entered Exodos path. */
    exodosPath: string;
    /** If the "use custom title bar" checkbox is checked. */
    useCustomTitlebar: boolean;
    /** Array of native platforms */
    nativePlatforms: string[];
};

export interface ConfigPage {}

/**
 * A page displaying some of the current "configs" / "preferences", as well as a way of changing them.
 * All changed "configs" (settings stored in "config.json") require you to "Save & Restart" to take effect.
 * The changed "preferences" (settings stored in "preferences.json") do not require a restart, and are updated directly.
 * @TODO Make it clear which settings are "configs" and which are "preferences" (or at least which require you to "save & restart")?
 */
export class ConfigPage extends React.Component<
    ConfigPageProps,
    ConfigPageState
> {
    /** Reference to the input element of the "current theme" drop-down field. */
    currentThemeInputRef: HTMLInputElement | HTMLTextAreaElement | null = null;

    constructor(props: ConfigPageProps) {
        super(props);
        const configData = window.External.config.data;
        this.state = {
            isExodosPathValid: undefined,
            exodosPath: configData.exodosPath,
            useCustomTitlebar: configData.useCustomTitlebar,
            nativePlatforms: configData.nativePlatforms,
        };
    }

    render() {
        const { platforms } = this.props;
        const { nativePlatforms } = this.state;
        const strings = englishTranslation.config;

        return (
            <div className="config-page simple-scroll">
                <div className="config-page__inner">
                    <h1 className="config-page__title">
                        {strings.configHeader}
                    </h1>
                    <i>{strings.configDesc}</i>

                    {/* -- Exodos -- */}
                    <div className="setting">
                        <p className="setting__title">{strings.exodosHeader}</p>
                        <div className="setting__body">
                            {/* Exodos Path */}
                            <div className="setting__row">
                                <div className="setting__row__top">
                                    <p className="setting__row__title">
                                        {strings.exodosPath}
                                    </p>
                                    <div className="setting__row__content setting__row__content--filepath-path">
                                        <ConfigExodosPathInput
                                            input={this.state.exodosPath}
                                            buttonText={strings.browse}
                                            onInputChange={
                                                this.onExodosPathChange
                                            }
                                            isValid={
                                                this.state.isExodosPathValid
                                            }
                                        />
                                    </div>
                                </div>
                                <div className="setting__row__bottom">
                                    <p>{strings.exodosPathDesc}</p>
                                </div>
                            </div>
                            {/* Native Platforms */}
                            <div className="setting__row">
                                <div className="setting__row__top">
                                    <div className="setting__row__title">
                                        <p>{strings.nativePlatforms}</p>
                                    </div>
                                    <div className="setting__row__content setting__row__content--toggle">
                                        <div>
                                            <Dropdown text={strings.platforms}>
                                                {platforms.map(
                                                    (platform, index) => (
                                                        <label
                                                            key={index}
                                                            className="log-page__dropdown-item"
                                                        >
                                                            <div className="simple-center">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={
                                                                        nativePlatforms.findIndex(
                                                                            (
                                                                                item
                                                                            ) =>
                                                                                item ===
                                                                                platform
                                                                        ) !== -1
                                                                    }
                                                                    onChange={() => {
                                                                        this.onNativeCheckboxChange(
                                                                            platform
                                                                        );
                                                                    }}
                                                                    className="simple-center__vertical-inner"
                                                                />
                                                            </div>
                                                            <div className="simple-center">
                                                                <p className="simple-center__vertical-inner log-page__dropdown-item-text">
                                                                    {platform}
                                                                </p>
                                                            </div>
                                                        </label>
                                                    )
                                                )}
                                            </Dropdown>
                                        </div>
                                    </div>
                                </div>
                                <div className="setting__row__bottom">
                                    <p>{strings.nativePlatformsDesc}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* -- Visuals -- */}
                    <div className="setting">
                        <p className="setting__title">
                            {strings.visualsHeader}
                        </p>
                        <div className="setting__body">
                            {/* Custom Title Bar */}
                            <div className="setting__row">
                                <div className="setting__row__top">
                                    <div className="setting__row__title">
                                        <p>{strings.useCustomTitleBar}</p>
                                    </div>
                                    <div className="setting__row__content setting__row__content--toggle">
                                        <div>
                                            <CheckBox
                                                checked={
                                                    this.state.useCustomTitlebar
                                                }
                                                onToggle={
                                                    this
                                                        .onUseCustomTitlebarChange
                                                }
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className="setting__row__bottom">
                                    <p>{strings.useCustomTitleBarDesc}</p>
                                </div>
                            </div>
                            {/* Theme */}
                            <div className="setting__row">
                                <div className="setting__row__top">
                                    <div className="setting__row__title">
                                        <p>{strings.theme}</p>
                                    </div>
                                    <div className="setting__row__content setting__row__content--input-field setting__row__content--theme-input-field">
                                        <DropdownInputField
                                            text={
                                                this.props.preferencesData
                                                    .currentTheme || ""
                                            }
                                            placeholder={strings.noTheme}
                                            onChange={this.onCurrentThemeChange}
                                            editable={true}
                                            items={[
                                                ...this.props.themeList.map(
                                                    formatThemeItemName
                                                ),
                                                "No Theme",
                                            ]}
                                            onItemSelect={
                                                this.onCurrentThemeItemSelect
                                            }
                                            inputRef={
                                                this.currentThemeInputRefFunc
                                            }
                                        />
                                    </div>
                                </div>
                                <div className="setting__row__bottom">
                                    <p>{strings.themeDesc}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* -- Advanced -- */}
                    <div className="setting">
                        <p className="setting__title">
                            {strings.advancedHeader}
                        </p>
                        <div className="setting__body">
                            {/* Show Developer Tab */}
                            <div className="setting__row">
                                <div className="setting__row__top">
                                    <div className="setting__row__title">
                                        <p>{strings.showDeveloperTab}</p>
                                    </div>
                                    <div className="setting__row__content setting__row__content--toggle">
                                        <div>
                                            <CheckBox
                                                checked={
                                                    this.props.preferencesData
                                                        .showDeveloperTab
                                                }
                                                onToggle={
                                                    this.onShowDeveloperTab
                                                }
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className="setting__row__bottom">
                                    <p>{strings.showDeveloperTabDesc}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* -- Save & Restart -- */}
                    <div className="setting">
                        <div className="setting__row">
                            <input
                                type="button"
                                value={strings.saveAndRestart}
                                className="simple-button save-and-restart"
                                onClick={this.onSaveAndRestartClick}
                            />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    onNativeCheckboxChange = (platform: string): void => {
        const { nativePlatforms } = this.state;
        const index = nativePlatforms.findIndex((item) => item === platform);

        if (index !== -1) {
            nativePlatforms.splice(index, 1);
        } else {
            nativePlatforms.push(platform);
        }
        this.setState({ nativePlatforms: nativePlatforms });
    };

    /** When the "Exodos Folder Path" input text is changed. */
    onExodosPathChange = async (filePath: string): Promise<void> => {
        this.setState({ exodosPath: filePath });
        // Check if the file-path points at a valid Exodos folder
        const isValid = await isExodosValidCheck(filePath);
        this.setState({ isExodosPathValid: isValid });
    };

    onUseCustomTitlebarChange = (isChecked: boolean): void => {
        this.setState({ useCustomTitlebar: isChecked });
    };

    onShowDeveloperTab = (isChecked: boolean): void => {
        updatePreferencesData({ showDeveloperTab: isChecked });
    };

    onCurrentThemeChange = (
        event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ): void => {
        updatePreferencesData({ currentTheme: event.currentTarget.value });
    };

    onCurrentThemeItemSelect = (_: string, index: number): void => {
        // Note: Suggestions with index 0 to "length - 1" are filenames of themes.
        //       Directly after that comes the "No Theme" suggestion.
        let theme: string | undefined;
        if (index < this.props.themeList.length) {
            // (Select a Theme)
            theme = this.props.themeList[index].entryPath;
        } else {
            theme = undefined;
        } // (Deselect the current theme)
        updatePreferencesData({ currentTheme: theme });
        // Select the input field
        if (this.currentThemeInputRef) {
            this.currentThemeInputRef.focus();
        }
    };

    currentThemeInputRefFunc = (
        ref: HTMLInputElement | HTMLTextAreaElement | null
    ): void => {
        this.currentThemeInputRef = ref;
    };

    /** When the "Save & Restart" button is clicked. */
    onSaveAndRestartClick = () => {
        // Save new config to file, then restart the app
        window.External.back.send<any, UpdateConfigData>(
            BackIn.UPDATE_CONFIG,
            {
                exodosPath: this.state.exodosPath,
                useCustomTitlebar: this.state.useCustomTitlebar,
            },
            () => {
                window.External.restart();
            }
        );
    };
}

/** Format a theme item into a displayable name for the themes drop-down. */
function formatThemeItemName(item: Theme): string {
    return `${item.meta.name} (${item.entryPath})`;
}
