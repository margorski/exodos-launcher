import { MenuItemConstructorOptions } from 'electron';
import { BrowserWindow, shell } from '@electron/remote';
import * as fs from 'fs';
import * as React from 'react';
import { BackIn, DeleteImageData, LaunchAddAppData, LaunchGameData, SaveImageData } from '@shared/back/types';
import { EXODOS_GAMES_PLATFORM_NAME, LOGOS, SCREENSHOTS } from '@shared/constants';
import { AdditionalApplicationInfo } from '@shared/game/AdditionalApplicationInfo';
import { wrapSearchTerm } from '@shared/game/GameFilter';
import { IAdditionalApplicationInfo, IGameInfo } from '@shared/game/interfaces';
import { GamePlaylistEntry, GamePropSuggestions, PickType } from '@shared/interfaces';
import { LangContainer } from '@shared/lang';
import { WithPreferencesProps } from '../containers/withPreferences';
import { WithSearchProps } from '../containers/withSearch';
import { getGameImagePath, getGameScreenshotsUrls, resourceExists } from '../Util';
import { LangContext } from '../util/lang';
import { uuid } from '../util/uuid';
import { DropdownInputField } from './DropdownInputField';
import { ImagePreview } from './ImagePreview';
import { InputField } from './InputField';
import { RightBrowseSidebarAddApp } from './RightBrowseSidebarAddApp';
import { getFileServerURL } from '@shared/Util';
import { openContextMenu } from '@main/Util';

type OwnProps = {
  /** Currently selected game (if any) */
  currentGame?: IGameInfo;
  /** Additional Applications of the currently selected game (if any) */
  currentAddApps?: IAdditionalApplicationInfo[];
  /** Notes of the selected game in the selected playlist (if any) */
  currentPlaylistNotes?: string;
  /* Current Library */
  currentLibrary: string;
  /** Currently selected game entry (if any) */
  gamePlaylistEntry?: GamePlaylistEntry;
  /** Called when the selected game is deleted by this */
  onDeleteSelectedGame: () => void;
  /** Called when the selected game is removed from the selected by this */
  onRemoveSelectedGameFromPlaylist?: () => void;
  /** Called when a playlist is deselected (searching game fields) */
  onDeselectPlaylist: () => void;
  /** Called when the playlist notes for the selected game has been changed */
  onEditPlaylistNotes: (text: string) => void;
  /** If the "edit mode" is currently enabled */
  isEditing: boolean;
  /** If the selected game is a new game being created */
  isNewGame: boolean;
  /** If the selected game is installed */
  isInstalled: boolean;
  /** ... */
  suggestions: Partial<GamePropSuggestions>;

  onEditClick: () => void;
  onDiscardClick: () => void;
  onSaveGame: () => void;
};

export type RightBrowseSidebarProps = OwnProps & WithPreferencesProps & WithSearchProps;

type RightBrowseSidebarState = {
  /** If a preview of the current game's screenshot should be shown. */
  screenshotPreviewUrl: string;
  screenshots: string[];
};

export interface RightBrowseSidebar {
  context: LangContainer;
}

/** Sidebar on the right side of BrowsePage. */
export class RightBrowseSidebar extends React.Component<RightBrowseSidebarProps, RightBrowseSidebarState> {
  // Bound "on change" callbacks for game fields
  onTitleChange               = this.wrapOnTextChange((game, text) => { game.convertedTitle      = text; });
  onAlternateTitlesChange     = this.wrapOnTextChange((game, text) => { game.alternateTitles     = text; });
  onDeveloperChange           = this.wrapOnTextChange((game, text) => { game.developer           = text; });
  onTagsChange                = this.wrapOnTextChange((game, text) => { game.tags                = text; });
  onSeriesChange              = this.wrapOnTextChange((game, text) => { game.series              = text; });
  onSourceChange              = this.wrapOnTextChange((game, text) => { game.source              = text; });
  onPublisherChange           = this.wrapOnTextChange((game, text) => { game.publisher           = text; });
  onPlatformChange            = this.wrapOnTextChange((game, text) => { game.platform            = text; });
  onPlayModeChange            = this.wrapOnTextChange((game, text) => { game.playMode            = text; });
  onStatusChange              = this.wrapOnTextChange((game, text) => { game.status              = text; });
  onVersionChange             = this.wrapOnTextChange((game, text) => { game.version             = text; });
  onReleaseDateChange         = this.wrapOnTextChange((game, text) => { game.releaseDate         = text; });
  onLanguageChange            = this.wrapOnTextChange((game, text) => { game.language            = text; });
  onLaunchCommandChange       = this.wrapOnTextChange((game, text) => { game.launchCommand       = text; });
  onApplicationPathChange     = this.wrapOnTextChange((game, text) => { game.applicationPath     = text; });
  onNotesChange               = this.wrapOnTextChange((game, text) => { game.notes               = text; });
  onOriginalDescriptionChange = this.wrapOnTextChange((game, text) => { game.originalDescription = text; });
  onBrokenChange              = this.wrapOnCheckBoxChange(game => { game.broken  = !game.broken;  });
  onExtremeChange             = this.wrapOnCheckBoxChange(game => { game.extreme = !game.extreme; });
  // Bound "on click" callbacks for game fields
  onDeveloperClick            = this.wrapOnTextClick('developer');
  onTagsClick                 = this.wrapOnTextClick('tags');
  onSeriesClick               = this.wrapOnTextClick('series');
  onSourceClick               = this.wrapOnTextClick('source');
  onPublisherClick            = this.wrapOnTextClick('publisher');
  onPlatformClick             = this.wrapOnTextClick('platform');
  onPlayModeClick             = this.wrapOnTextClick('playMode');
  onStatusClick               = this.wrapOnTextClick('status');
  onVersionClick              = this.wrapOnTextClick('version');
  onLanguageClick             = this.wrapOnTextClick('language');

  launchCommandRef: React.RefObject<HTMLInputElement> = React.createRef();

  constructor(props: RightBrowseSidebarProps) {
    super(props);
    this.state = {
      screenshotPreviewUrl: "",
      screenshots: []
    };
  }

  async getExistingScreenshotsList(game: IGameInfo | null) : Promise<string[]> {
    if (!game) return [];

    var allScreenshots = getGameScreenshotsUrls(game.platform, game.title);
    var existingScreenshots = [];

    for (var s of allScreenshots) {
      if (await resourceExists(s)) existingScreenshots.push(s);
    }
    return existingScreenshots;
  }

  componentDidMount() {
    // window.External.back.on('message', this.onResponse);
    window.addEventListener('keydown', this.onGlobalKeyDown);
  }

  componentWillUnmount() {
    // window.External.back.off('message', this.onResponse);
    window.removeEventListener('keydown', this.onGlobalKeyDown);
  }

  componentDidUpdate(prevProps: RightBrowseSidebarProps, prevState: RightBrowseSidebarState): void {
    if (this.props.currentGame !== prevProps.currentGame) {
      if (this.props.currentGame) {
        this.getExistingScreenshotsList(this.props.currentGame).then(screenshots => {
          this.setState({
            screenshots: screenshots
          });
        });
      }
      else {
        this.setState({
          screenshots: []
        });
      }
    }
  }

  render() {
    const strings = this.context.browse;
    const game: IGameInfo | undefined = this.props.currentGame;

    // TODO
    if (game) {
      const { currentAddApps, gamePlaylistEntry, currentPlaylistNotes, isEditing, isNewGame, isInstalled, preferencesData, suggestions } = this.props;
      const isPlaceholder = game.placeholder;
      const editDisabled = !preferencesData.enableEditing;
      const editable = !editDisabled && isEditing;
      const isDosPlatform = game.platform === EXODOS_GAMES_PLATFORM_NAME;
      const playButtonLabel = isDosPlatform ? (isInstalled ? strings.play : strings.install) : strings.open;
      return (
        <div
          className={'browse-right-sidebar ' + (editable ? 'browse-right-sidebar--edit-enabled' : 'browse-right-sidebar--edit-disabled')}
          onKeyDown={this.onLocalKeyDown}>
          {/* -- Title & Developer(s) -- */}
          <div className='browse-right-sidebar__section'>
            <div className='browse-right-sidebar__row'>
              <div className='browse-right-sidebar__title-row'>
                <div className='browse-right-sidebar__title-row__title'>
                  <InputField
                    text={game.convertedTitle}
                    placeholder={strings.noTitle}
                    editable={editable}
                    onChange={this.onTitleChange}
                    onKeyDown={this.onInputKeyDown} />
                </div>
                <div className='browse-right-sidebar__title-row__buttons'>
                  <input
                    type='button'
                    className='simple-button'
                    value={playButtonLabel}
                    onClick={() => window.External.back.send<LaunchGameData>(BackIn.LAUNCH_GAME, { id: game.id })}
                    />
                  { isDosPlatform ? <input
                    type='button'
                    className='simple-button'
                    disabled={!isInstalled}
                    value={strings.setup}
                    onClick={() => window.External.back.send<LaunchGameData>(BackIn.LAUNCH_GAME_SETUP, { id: game.id })}
                    /> : null}
                </div>
              </div>
            </div>
            { isPlaceholder ? undefined : (
              <div className='browse-right-sidebar__row browse-right-sidebar__row--one-line'>
                <p>{strings.by} </p>
                <InputField
                  text={game.developer}
                  placeholder={strings.noDeveloper}
                  className='browse-right-sidebar__searchable'
                  editable={editable}
                  onChange={this.onDeveloperChange}
                  onClick={this.onDeveloperClick}
                  onKeyDown={this.onInputKeyDown} />
              </div>
            ) }
          </div>
          {/* -- Most Fields -- */}
          { isPlaceholder ? undefined : (
            <>
              <div className='browse-right-sidebar__section'>
                <div className='browse-right-sidebar__row browse-right-sidebar__row--one-line'>
                  <p>{strings.tags}: </p>
                  <DropdownInputField
                    text={game.tags}
                    placeholder={strings.noTags}
                    className='browse-right-sidebar__searchable'
                    onChange={this.onTagsChange}
                    editable={editable}
                    items={suggestions && filterSuggestions(suggestions.tags) || []}
                    onItemSelect={text => { game.tags = text; this.forceUpdate(); }}
                    onClick={this.onTagsClick}
                    onKeyDown={this.onInputKeyDown} />
                </div>
                <div className='browse-right-sidebar__row browse-right-sidebar__row--one-line'>
                  <p>{strings.series}: </p>
                  <InputField
                    text={game.series}
                    placeholder={strings.noSeries}
                    className='browse-right-sidebar__searchable'
                    onChange={this.onSeriesChange}
                    editable={editable}
                    onClick={this.onSeriesClick}
                    onKeyDown={this.onInputKeyDown} />
                </div>
                <div className='browse-right-sidebar__row browse-right-sidebar__row--one-line'>
                  <p>{strings.developer}: </p>
                  <InputField
                    text={game.developer}
                    placeholder={strings.noDeveloper}
                    className='browse-right-sidebar__searchable'
                    onChange={this.onDeveloperChange}
                    editable={editable}
                    onClick={this.onDeveloperClick}
                    onKeyDown={this.onInputKeyDown} />
                </div>
                <div className='browse-right-sidebar__row browse-right-sidebar__row--one-line'>
                  <p>{strings.publisher}: </p>
                  <InputField
                    text={game.publisher}
                    placeholder={strings.noPublisher}
                    className='browse-right-sidebar__searchable'
                    onChange={this.onPublisherChange}
                    editable={editable}
                    onClick={this.onPublisherClick}
                    onKeyDown={this.onInputKeyDown} />
                </div>
                <div className='browse-right-sidebar__row browse-right-sidebar__row--one-line'>
                  <p>{strings.source}: </p>
                  <InputField
                    text={game.source}
                    placeholder={strings.noSource}
                    onChange={this.onSourceChange}
                    className='browse-right-sidebar__searchable'
                    editable={editable}
                    onClick={this.onSourceClick}
                    onKeyDown={this.onInputKeyDown} />
                </div>
                <div className='browse-right-sidebar__row browse-right-sidebar__row--one-line'>
                  <p>{strings.platform}: </p>
                  <DropdownInputField
                    text={game.platform}
                    placeholder={strings.noPlatform}
                    onChange={this.onPlatformChange}
                    className='browse-right-sidebar__searchable'
                    editable={editable}
                    items={suggestions && filterSuggestions(suggestions.platform) || []}
                    onItemSelect={text => { game.platform = text; this.forceUpdate(); }}
                    onClick={this.onPlatformClick}
                    onKeyDown={this.onInputKeyDown} />
                </div>
                <div className='browse-right-sidebar__row browse-right-sidebar__row--one-line'>
                  <p>{strings.playMode}: </p>
                  <DropdownInputField
                    text={game.playMode}
                    placeholder={strings.noPlayMode}
                    onChange={this.onPlayModeChange}
                    className='browse-right-sidebar__searchable'
                    editable={editable}
                    items={suggestions && filterSuggestions(suggestions.playMode) || []}
                    onItemSelect={text => { game.playMode = text; this.forceUpdate(); }}
                    onClick={this.onPlayModeClick}
                    onKeyDown={this.onInputKeyDown} />

                </div>
                <div className='browse-right-sidebar__row browse-right-sidebar__row--one-line'>
                  <p>{strings.releaseYear}: </p>
                  <InputField
                    text={(new Date(game.releaseDate)).getFullYear().toString()}
                    placeholder={strings.noReleaseDate}
                    onChange={this.onReleaseDateChange}
                    className='browse-right-sidebar__searchable'
                    editable={editable}
                    onClick={() => this.props.onSearch(`releaseDate:${(new Date(game.releaseDate)).getFullYear().toString()}`)}
                    onKeyDown={this.onInputKeyDown} />
                </div>
              </div>
            </>
          ) }
          {/* -- Screenshot -- */}
          <div className='browse-right-sidebar__section'>
          { this.state.screenshots.map((s, idx) =>
            <div className='browse-right-sidebar__row' key={`screenshot-row-div-${idx}`}>
              <div
                className='browse-right-sidebar__row__screenshot'
                key={`screenshot-div-${idx}`}
                onContextMenu={this.onScreenshotContextMenu}>
                  <img
                    className='browse-right-sidebar__row__screenshot-image'
                    alt='' // Hide the broken link image if source is not found
                    src={s}
                    key={`screenshot-img-${idx}`}
                    onClick={() => this.onScreenshotClick(s)} />
              </div>
            </div>
          )}
          </div>
          {/* -- Playlist Game Entry Notes -- */}
          { gamePlaylistEntry ? (
            <div className='browse-right-sidebar__section'>
              <div className='browse-right-sidebar__row'>
                <p>{strings.playlistNotes}: </p>
                <InputField
                  text={currentPlaylistNotes|| ''}
                  placeholder={strings.noPlaylistNotes}
                  onChange={this.onEditPlaylistNotes}
                  editable={editable}
                  multiline={true} />
              </div>
            </div>
          ) : undefined }
          {/* -- Notes -- */}
          { (!editDisabled || game.notes) && !isPlaceholder ? (
            <div className='browse-right-sidebar__section'>
              <div className='browse-right-sidebar__row'>
                <p>{strings.notes}: </p>
                <InputField
                  text={game.notes}
                  placeholder={strings.noNotes}
                  onChange={this.onNotesChange}
                  editable={editable}
                  multiline={true} />
              </div>
            </div>
          ) : undefined }
          {/* -- Original Description -- */}
          { (!editDisabled || game.originalDescription) && !isPlaceholder ? (
            <div className='browse-right-sidebar__section'>
              <div className='browse-right-sidebar__row'>
                <p>{strings.originalDescription}: </p>
                <InputField
                  text={game.originalDescription}
                  placeholder={strings.noOriginalDescription}
                  onChange={this.onOriginalDescriptionChange}
                  editable={editable}
                  multiline={true} />
              </div>
            </div>
          ) : undefined }
          {/* -- Additional Applications -- */}
          { editable || (currentAddApps && currentAddApps.length > 0) ? (
            <div className='browse-right-sidebar__section'>
              <div className='browse-right-sidebar__row browse-right-sidebar__row--additional-applications-header'>
                <p>{strings.additionalApplications}:</p>
                { editable ? (
                  <input
                    type='button'
                    value={strings.new}
                    className='simple-button'
                    onClick={this.onNewAddAppClick} />
                ) : undefined }
              </div>
              { currentAddApps && currentAddApps.map((addApp) => (
                <RightBrowseSidebarAddApp
                  key={addApp.id}
                  addApp={addApp}
                  editDisabled={!editable}
                  onLaunch={this.onAddAppLaunch}
                  onDelete={this.onAddAppDelete} />
              )) }
            </div>
          ) : undefined }

          {/* -- Screenshot Preview -- */}
          { this.state.screenshotPreviewUrl ? (
            <ImagePreview
              src={this.state.screenshotPreviewUrl}
              onCancel={this.onScreenshotPreviewClick} />
          ) : undefined }
        </div>
      );
    } else {
      return (
        <div className='browse-right-sidebar-empty'>
          <h1>{strings.noGameSelected}</h1>
          <p>{strings.clickToSelectGame}</p>
        </div>
      );
    }
  }

  /** When a key is pressed down "globally" (and this component is present) */
  onGlobalKeyDown = (event: KeyboardEvent) => {
    // Start editing
    if (event.ctrlKey && event.code === 'KeyE' && // (CTRL + E ...
        !this.props.isEditing && this.props.currentGame) { // ... while not editing, and a game is selected)
      this.props.onEditClick();
      if (this.launchCommandRef.current) { this.launchCommandRef.current.focus(); }
      event.preventDefault();
    }
  }

  onLocalKeyDown = (event: React.KeyboardEvent) => {
    // Save changes
    if (event.ctrlKey && event.key === 's' && // (CTRL + S ...
        this.props.isEditing && this.props.currentGame) { // ... while editing, and a game is selected)
      this.props.onSaveGame();
      event.preventDefault();
    }
  }

  onScreenshotContextMenu = (event: React.MouseEvent) => {
    const { currentGame } = this.props;
    const template: MenuItemConstructorOptions[] = [];
    if (currentGame) {
      template.push({
        label: this.context.menu.viewThumbnailInFolder,
        click: () => { shell.showItemInFolder(getGameImagePath(LOGOS, currentGame.id).replace(/\//g, '\\')); },
        enabled: true
      });
      template.push({
        label: this.context.menu.viewScreenshotInFolder,
        click: () => { shell.showItemInFolder(getGameImagePath(SCREENSHOTS, currentGame.id).replace(/\//g, '\\')); },
        enabled: true
      });
    }
    if (template.length > 0) {
      event.preventDefault();
      openContextMenu(template);
    }
  }

  onAddScreenshotDialog = this.addImageDialog(SCREENSHOTS);
  onAddThumbnailDialog = this.addImageDialog(LOGOS);

  addImageDialog(folder: typeof LOGOS | typeof SCREENSHOTS) {
    return () => {
      const { currentGame } = this.props;
      if (!currentGame) { throw new Error('Failed to add image file. The currently selected game could not be found.'); }
      // Synchronously show a "open dialog" (this makes the main window "frozen" while this is open)
      const filePaths = window.External.showOpenDialogSync({
        title: this.context.dialog.selectScreenshot,
        properties: ['openFile']
      });
      if (filePaths && filePaths[0]) {
        fs.readFile(filePaths[0], (error, data) => {
          if (error) { console.error(error); }
          else {
            window.External.back.send<any, SaveImageData>(BackIn.SAVE_IMAGE, {
              folder: folder,
              id: currentGame.id,
              content: data.toString('base64'),
            });
          }
        });
      }
    };
  }

  onRemoveScreenshotClick = this.removeImage.bind(this, SCREENSHOTS);
  onRemoveThumbnailClick = this.removeImage.bind(this, LOGOS);

  removeImage(folder: string): void {
    if (this.props.currentGame) {
      window.External.back.send<DeleteImageData>(BackIn.DELETE_IMAGE, {
        folder: folder,
        id: this.props.currentGame.id,
      });
    }
  }

  onThumbnailDrop = this.imageDrop(LOGOS);
  onScreenshotDrop = this.imageDrop(SCREENSHOTS);

  imageDrop(type: typeof LOGOS | typeof SCREENSHOTS): (event: React.DragEvent) => void {
    return event => {
      event.preventDefault();
      const files = copyArrayLike(event.dataTransfer.files);
      const { currentGame } = this.props;
      if (!currentGame) { throw new Error('Can not add a new image, "currentGame" is missing.'); }
      if (files.length > 1) { // (Multiple files)
        saveImage(files[0], LOGOS, currentGame.id);
        saveImage(files[1], SCREENSHOTS, currentGame.id);
      } else { // (Single file)
        saveImage(files[0], type, currentGame.id);
      }

      function saveImage(file: Blob, folder: string, id: string) {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (reader.result && typeof reader.result === 'object') {
            window.External.back.send<any, SaveImageData>(BackIn.SAVE_IMAGE, {
              folder: folder,
              id: id,
              content: Buffer.from(reader.result).toString('base64'),
            });
          }
        };
        reader.readAsArrayBuffer(file.slice(0, file.size - 1));
      }
      function copyArrayLike<T>(arrayLike: { [key: number]: T }): Array<T> {
        const array: T[] = [];
        for (let key in arrayLike) {
          array[key] = arrayLike[key];
        }
        return array;
      }
    };
  }

  onDeleteGameClick = (): void => {
    this.props.onDeleteSelectedGame();
  }

  onAddAppLaunch(addApp: IAdditionalApplicationInfo): void {
    const isHtml = addApp.applicationPath.toLocaleLowerCase().endsWith('.html') ||
                   addApp.applicationPath.toLocaleLowerCase().endsWith('.htm');
    if (isHtml) {
      let url = `${getFileServerURL()}/${addApp.applicationPath.replace('\\', '/')}`;
      console.log(`Got HTML additional application, running in new browser window. ${url}`);
      let win = new BrowserWindow(
        {
          show: false,
          title: addApp.name,
          resizable: false,
          width: 1100,
          height: 962
        });
      win.setMenuBarVisibility(false);
      win.loadURL(url);
      win.once('ready-to-show', () => {
          win.show();
          win.focus();
      });
    }
    else {
      window.External.back.send<any, LaunchAddAppData>(BackIn.LAUNCH_ADDAPP, { id: addApp.id });
    }
  }

  onAddAppDelete = (addAppId: string): void => {
    const addApps = this.props.currentAddApps;
    if (!addApps) { throw new Error('editAddApps is missing.'); }
    const index = addApps.findIndex(addApp => addApp.id === addAppId);
    if (index === -1) { throw new Error('Cant remove additional application because it was not found.'); }
    addApps.splice(index, 1);
    this.forceUpdate();
  }

  onNewAddAppClick = (): void => {
    if (!this.props.currentAddApps) { throw new Error('Unable to add a new AddApp. "currentAddApps" is missing.'); }
    if (!this.props.currentGame)    { throw new Error('Unable to add a new AddApp. "currentGame" is missing.'); }
    const newAddApp = AdditionalApplicationInfo.create();
    newAddApp.id = uuid();
    newAddApp.gameId = this.props.currentGame.id;
    this.props.currentAddApps.push(newAddApp);
    this.forceUpdate();
  }
  onScreenshotClick = (screenshotUrl:string): void => {
    this.setState({ screenshotPreviewUrl: screenshotUrl });
  }

  onScreenshotPreviewClick = (): void => {
    this.setState({ screenshotPreviewUrl: "" });
  }

  onEditPlaylistNotes = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
    this.props.onEditPlaylistNotes(event.currentTarget.value);
  }

  /** When a key is pressed while an input field is selected (except for multiline fields) */
  onInputKeyDown = (event: React.KeyboardEvent): void => {
    if (event.key === 'Enter') { this.props.onSaveGame(); }
  }


  /** Create a callback for when a game field is clicked. */
  wrapOnTextClick<T extends PickType<IGameInfo, string>>(field: T): () => void {
    return () => {
      const { currentGame, isEditing } = this.props;
      if (!isEditing && currentGame) {
        this.props.onDeselectPlaylist();
        const value = currentGame[field];
        const search = (value)
          ? `${field}:${wrapSearchTerm(value)}`
          : `missing:${field}`;
        this.props.onSearch(search);
      }
    };
  }

  /** Create a wrapper for a EditableTextWrap's onChange callback (this is to reduce redundancy). */
  wrapOnTextChange(func: (game: IGameInfo, text: string) => void): (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void {
    return (event) => {
      const game = this.props.currentGame;
      if (game) {
        func(game, event.currentTarget.value);
        this.forceUpdate();
      }
    };
  }

  /** Create a wrapper for a CheckBox's onChange callback (this is to reduce redundancy). */
  wrapOnCheckBoxChange(func: (game: IGameInfo) => void): () => void {
    return () => {
      const game = this.props.currentGame;
      const editable = this.props.preferencesData.enableEditing && this.props.isEditing;
      if (game && editable) {
        func(game);
        this.forceUpdate();
      }
    };
  }

  static contextType = LangContext;
}

function filterSuggestions(suggestions?: string[]): string[] {
  if (!suggestions) { return []; }
  // if (suggestions.length > 25) { return suggestions.slice(0, 25); }
  return suggestions;
}