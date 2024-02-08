import { connect } from "react-redux";
import { bindActionCreators, Dispatch } from "redux";
import { App } from "../app";
import { ApplicationState } from "../store";
import { withPreferences } from "./withPreferences";
import { withRouter } from "./withRouter";

const mapStateToProps = ({ search }: ApplicationState) => ({
    search: search.query,
});

const mapDispatchToProps = (dispatch: Dispatch) =>
    bindActionCreators(
        {
            // ...
        },
        dispatch
    );

export default withRouter(
    withPreferences(connect(mapStateToProps, mapDispatchToProps)(App))
);
