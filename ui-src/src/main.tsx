import { render } from 'preact'
import { ErrorBoundary, lazy, LocationProvider, Router, Route } from 'preact-iso';
import { Bludclart } from './routes/bludclart.tsx';
import { ErrorProvider } from './components/error.tsx';
import './global.scss'

const Index = lazy(() => import('./routes/index.tsx'));
const NotFound = lazy(() => import('./routes/_404.tsx'));

const App = () => {
    return (
        <LocationProvider>
            <ErrorBoundary>
                <Router>
                    <Route path="/" component={Index} />
                    <Route path="/bludclart" component={Bludclart} />
                    <Route default component={NotFound} />
                </Router>
            </ErrorBoundary>
        </LocationProvider>
    )
};

render(<ErrorProvider><App /></ErrorProvider>, document.getElementById('app')!)
