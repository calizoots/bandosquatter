import { Component, ComponentType } from 'preact';
import Cookies from 'js-cookie';
import axios from 'axios';
import { hostname } from '../global/global';
import FourOhFour from '../pages/404';

interface WithAuthProps { }

export interface WithAuthState {
    isAuthenticated: boolean;
    isLoading: boolean;
}

export const withAuth = <P extends WithAuthProps>(WrappedComponent: ComponentType<P>): ComponentType<P> => {
    return class extends Component<P, WithAuthState> {
        constructor(props: P) {
            super(props);
            this.state = {
                isAuthenticated: false,
                isLoading: true,
            };
        }

        componentDidMount() {
            this.checkAuth();
        }

        async checkAuth() {
            const token = Cookies.get('token');
            if (!token) {
                this.setState({ isAuthenticated: false, isLoading: false });
                return;
            }
            try {
                if (token) {
                    const res = await axios.post(`${hostname}/verify`, `jwt=${token}`);
                    if (res.data.jwt) {
                        this.setState({ isAuthenticated: true, isLoading: false });
                    } else {
                        this.setState({ isAuthenticated: false, isLoading: false });
                    }
                }
            } catch (error) {
                this.setState({ isAuthenticated: false, isLoading: false });
            }
        }

        render() {
            const { isAuthenticated, isLoading } = this.state;
            if (isLoading) {
                return <span style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    width: "100vw",
                    height: "100vh"
                }}>🙈Loading🙉</span>;
            }
            return isAuthenticated ? <WrappedComponent {...this.props} /> : <FourOhFour />;
        }
    };
};