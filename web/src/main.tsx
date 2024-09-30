import { render } from 'preact'
import Router, { Route } from 'preact-router'
import { Landing } from './pages/Landing.tsx'
import fourofour from './pages/404.tsx'
import { bludclart } from './pages/bludclart.tsx'
import { oblock } from './pages/oblock.tsx'

const Main = () => (
    <Router>
        <Route path="/" component={Landing} />
        <Route path="/bludclart" component={bludclart} />
        <Route path="/oblock" component={oblock}/>
        <Route path="*" component={fourofour} default={true} />
    </Router>
)

render(<Main />, document.getElementById('sawnofftingindapassy')!);