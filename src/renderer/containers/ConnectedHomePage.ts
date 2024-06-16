import { connect } from "react-redux";
import { bindActionCreators, Dispatch } from "redux";
import { Subtract } from "@shared/interfaces";
import { HomePage, HomePageProps } from "../components/pages/HomePage";
import { withPreferences, WithPreferencesProps } from "./withPreferences";

export type ConnectedHomePageProps = Subtract<
    HomePageProps,
    WithPreferencesProps
>;

export const ConnectedHomePage = withPreferences(connect(undefined, undefined)(HomePage));
