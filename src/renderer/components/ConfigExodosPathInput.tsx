import * as React from 'react';

export type ConfigExodosPathInputProps = {
  /** Initial value of the input field. */
  input?: string;
  /** If the current input is valid. */
  isValid?: boolean;
  /** Text to display on the button */
  buttonText?: string;
  /** Called when the value of the input field is changed. */
  onInputChange?: (input: string) => void;
};

/** Text input element made specifically for setting the eXoDOS path at the config page. */
export class ConfigExodosPathInput extends React.Component<ConfigExodosPathInputProps> {
  componentDidMount() {
    if (this.props.onInputChange) { this.props.onInputChange(this.props.input || ''); }
  }

  render() {
    const { input, isValid } = this.props;
    let className: string = 'exodos-path__input';
    if (isValid !== undefined) {
      className += isValid ? ' exodos-path__input--valid' : ' exodos-path__input--invalid';
    }
    return (
      <>
        <div className={className}>
          <input
            type='text'
            onChange={this.onInputChange}
            value={input} />
        </div>
        <input
          type='button'
          value={this.props.buttonText}
          className='simple-button'
          onClick={this.onBrowseClick} />
      </>
    );
  }

  onInputChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    this.setInput(event.target.value);
  }

  onBrowseClick = (): void => {
    // Synchronously show a "open dialog" (this makes the main window "frozen" while this is open)
    const filePaths = window.External.showOpenDialogSync({
      title: 'Select the eXoDOS root directory',
      properties: ['openDirectory'],
    });
    if (filePaths) { this.setInput(filePaths[0]); }
  }

  setInput(input: string): void {
    if (this.props.onInputChange) { this.props.onInputChange(input || ''); }
  }
}
