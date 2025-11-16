import { Component, type ComponentType } from 'preact';
import { HOSTNAME } from '../global.ts'
import FourOhFour from '../routes/_404.tsx';

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
            try {
                const res = await fetch(`${HOSTNAME}/user/verify`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    credentials: "include",
                });

                const data = await res.json();

                if (data.status == "ok") {
                    this.setState({ isAuthenticated: true, isLoading: false });
                } else {
                    this.setState({ isAuthenticated: false, isLoading: false });
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
