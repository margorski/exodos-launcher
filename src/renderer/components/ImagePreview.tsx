import { getFileServerURL } from "@shared/Util";
import * as React from "react";
import { BareFloatingContainer } from "./FloatingContainer";
import { FormattedGameMedia, FormattedGameMediaType } from "./GameImageCarousel";

export type MediaPreviewProps = {
    /** Media to display. */
    media: FormattedGameMedia;
    /** Called when the user attempts to cancel/close media preview. */
    onCancel?: () => void;
};

export function MediaPreview(props: MediaPreviewProps) {
    const [scaleUp, setScaleUp] = React.useState(false);

    const onClickImage = (event: React.MouseEvent<any>) => {
        setScaleUp(!scaleUp);
        event.preventDefault();
        event.stopPropagation();
        return false;
    }

    const renderedMedia = () => {
        switch (props.media.type) {
            case FormattedGameMediaType.IMAGE: {
                return (
                    <img
                        className={
                            "image-preview__image" +
                            (scaleUp
                                ? " image-preview__image--fill"
                                : " image-preview__image--fit")
                        }
                        src={`${getFileServerURL()}/${props.media.path}`}
                        onClick={onClickImage} />
                );
            }
            case FormattedGameMediaType.VIDEO: {
                return (
                    <video
                        controls
                        autoPlay
                        className={
                            "image-preview__image" +
                            (scaleUp
                                ? " image-preview__image--fill"
                                : " image-preview__image--fit")
                        }
                        src={`${getFileServerURL()}/${props.media.path}`}/>
                );
            }
        }
    }

    const onClickBackground = (event: React.MouseEvent<HTMLDivElement>) => {
        if (props.onCancel) {
            props.onCancel();
        }
    };

    return (
        <BareFloatingContainer>
            <div className="image-preview-container" style={{overflowY: scaleUp ? 'auto' : 'unset'}} onClick={onClickBackground}>
                <div style={{height: scaleUp ? "auto" : "97%"}}>
                    <div className={
                            "image-preview" +
                            (scaleUp
                                ? " image-preview--fill"
                                : " image-preview--fit")
                        }>
                        {renderedMedia()}
                    </div>
                </div>
                <div className="image-preview-label">
                    {props.media.name}
                </div>
            </div>
        </BareFloatingContainer>

    )
}
