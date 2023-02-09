import { UpdateInfo } from 'electron-updater';
import * as React from 'react';
import { Link } from 'react-router-dom';
import { ExodosBackendInfo, GamePlaylist } from '@shared/interfaces';
import { WithPreferencesProps } from '../../containers/withPreferences';
import { WithSearchProps } from '../../containers/withSearch';
import { LangContext } from '../../util/lang';
import { OpenIcon, OpenIconType } from '../OpenIcon';
import { RandomGames } from '../RandomGames';
import { SizeProvider } from '../SizeProvider';
import { BackIn, LaunchExodosContentData } from '@shared/back/types';
import { app } from '@electron/remote';

type OwnProps = {
  platforms: Record<string, string[]>;
  playlists: GamePlaylist[];
  onSelectPlaylist: (library: string, playlistId: string | undefined) => void;
  onLaunchGame: (gameId: string) => void;
  /** Clear the current search query (resets the current search filters). */
  clearSearch: () => void;
  /** Whether an update is available to the Launcher */
  updateInfo: UpdateInfo | undefined;
  /** Callback to initiate the update */
  exodosBackendInfo: ExodosBackendInfo | undefined;
};

export type HomePageProps = OwnProps & WithPreferencesProps & WithSearchProps;

export function HomePage(props: HomePageProps) {
  const allStrings = React.useContext(LangContext);
  const strings = allStrings.home;

  const onLaunchGame = React.useCallback((gameId: string) => {
    props.onLaunchGame(gameId);
  }, [props.onLaunchGame]);

  const onLaunchCommand = React.useCallback((commandPath) => {
    window.External.back.send<any, LaunchExodosContentData>(BackIn.LAUNCH_COMMAND, { path: commandPath });
  }, []);

  // (These are kind of "magic numbers" and the CSS styles are designed to fit with them)
  const height: number = 140;
  const width: number = (height * 0.666) | 0;

  // -- Render the boxes --

  const renderedSetupSection = React.useMemo(() => (
    <div className='home-page__box home-page__box_narrow'>
      <div className='home-page__box-head'>Setup</div>
      <ul className='home-page__box-body'>
        <QuickStartItem icon='wrench'>
          <Link
            to='#'
            onClick={() => onLaunchCommand('install_linux_dependencies.sh')}>
            Install dependencies
          </Link>
        </QuickStartItem>
        <QuickStartItem icon='cog'>
          <Link
            to='#'
            onClick={() => onLaunchCommand('Setup.sh')}>
            eXoDOS Setup
          </Link>
        </QuickStartItem>
        <QuickStartItem icon='data-transfer-download'>
          <Link
            to='#'
            onClick={() => onLaunchCommand('eXo/Update/update.sh')}>
            Check for updates
          </Link>
        </QuickStartItem>
      </ul>
    </div>
  ), [strings, onLaunchCommand]);

  const renderedDocs = React.useMemo(() => (
    <div className='home-page__box home-page__box_narrow'>
      <div className='home-page__box-head'>Docs</div>
      <ul className='home-page__box-body'>
        <QuickStartItem icon='script'>
          <Link
            to='#'
            onClick={() => onLaunchCommand('eXoDOS ReadMe.txt')}>
            ReadMe
          </Link>
        </QuickStartItem>
        <QuickStartItem icon='script'>
          <Link
            to='#'
            onClick={() => onLaunchCommand('eXoDOS Linux ReadMe.txt')}>
            Linux ReadMe
          </Link>
        </QuickStartItem>
        <QuickStartItem icon='book'>
          <Link
            to='#'
            onClick={() => onLaunchCommand('eXoDOS Manual.pdf')}>
            Manual
          </Link>
        </QuickStartItem>
        <QuickStartItem icon='book'>
          <Link
            to='#'
            onClick={() => onLaunchCommand('eXoDOS Catalog.pdf')}>
            Catalog
          </Link>
        </QuickStartItem>
      </ul>
    </div>
  ), [strings, onLaunchCommand]);

  const renderedChangelog = React.useMemo(() => (
    <div className='home-page__box'>
      <div className='home-page__box-head'>Changelog</div>
      <ul className='home-page__box-body home-page__changelog'>
          {props.exodosBackendInfo ? 
            props.exodosBackendInfo.changelog.split("\n").map((line, idx) => (<div key={`changelog-${idx}-line`}>{line.trim() ? line : (<br />)}</div>))
            : '' }
      </ul>
    </div>
  ), [props.exodosBackendInfo, strings]);

  const renderedGreetings = React.useMemo(() => (
    <div className='home-page__box'>
      <div className='home-page__box-head'>Welcome to eXoDOS!</div>
      <div className='home-page__box-body'>
        <p>This pack includes 7,200 DOS games. The games have already been configured to run in DOSBox. Games which are supported by ScummVM will give you the option at launch as to which emulator you would like to use.</p>
        <br />
        <p>If you have not already done so, run the utilities in the Setup box to install the collection on your computer. Then, click on the MS-DOS tab to browse through and play the games, or the DOS Magazines tab to read magazines.</p>
      </div>
    </div>
  ), []);

  const renderedHeader = () => (
    <div className='home-page__two_columns_container'>
      <div className='home-page__header'>
        <div className=''>
          <div><h1>eXoDOS v5</h1></div> 
          <div><h4>{`backend: ${props.exodosBackendInfo ? props.exodosBackendInfo.version : ''}`}</h4></div>
          <div><h4>{`exogui: ${app.getVersion()}`}</h4></div>
        </div>
        <div className='home-page__subheader'>
          {link('Website', 'https://www.retro-exo.com/exodos.html')}
          |
          {link('Discord', 'https://discord.gg/SaMKayf')}
        </div>
      </div>
      {/* Logo */}
      <div className='home-page__logo'>
        <img src="images/logo.png" />
      </div>
    </div>
  );

  const link = (title: string, url: string): JSX.Element => {
    return (
      <a
        href={url}
        title={url}>
        {title}
      </a>
    );
  }

  const renderedRandomGames = React.useMemo(() => (
    <SizeProvider width={width} height={height}>
      <div className='home-page__random-games'>
        <div className='home-page__random-games__inner'>
          <p className='home-page__random-games__title'>{strings.randomPicks}</p>
            <RandomGames
              broken={window.External.config.data.showBrokenGames}
              extreme={props.preferencesData.browsePageShowExtreme}
              onLaunchGame={onLaunchGame} />
        </div>
      </div>
    </SizeProvider>
  ), [strings, onLaunchGame]);

  // Render
  return (
    <div className='home-page simple-scroll'>
      <div className='home-page__inner'>
        { renderedHeader() }
        { renderedGreetings }
        <div className='home-page__two_columns_container'>
          {/* Quick Start */}
          { renderedSetupSection }
          {/* Extras */}
          { renderedDocs }
        </div>
        { renderedChangelog }
      </div>
    </div>
  ); //, [renderedHeader, renderedGreetings, renderedSetupSection, renderedDocs, renderedChangelog]);
}

function QuickStartItem(props: { icon?: OpenIconType, className?: string, children?: React.ReactNode }): JSX.Element {
  return (
    <li className={'home-page__box-item simple-center ' + (props.className||'')}>
      { props.icon ? (
         <div className='home-page__box-item-icon simple-center__vertical-inner'>
          <OpenIcon icon={props.icon} />
        </div>
      ) : undefined }
      <div className='simple-center__vertical-inner'>
        {props.children}
      </div>
    </li>
  );
}