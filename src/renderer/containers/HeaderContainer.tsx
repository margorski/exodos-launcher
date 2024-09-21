import * as React from "react";
import { connect } from "react-redux";
import { useNavigate } from "react-router";
import { Header, HeaderProps } from "../components/Header";
import { withPreferences, WithPreferencesProps } from "./withPreferences";
import { withRouter } from "./withRouter";

type HeaderContainerProps = HeaderProps & WithPreferencesProps;

const HeaderContainer: React.FunctionComponent<HeaderContainerProps> = (
    props: HeaderContainerProps
) => {
    const { ...rest } = props;

    return <Header {...rest} />;
};

export default withPreferences(connect(undefined, undefined)(HeaderContainer));
