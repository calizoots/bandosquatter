import { render } from 'preact'
import Router, { Route } from 'preact-router'
import { Landing } from './components/pages/Landing.tsx'
import fourofour from './components/pages/404.tsx'
import { bludclart } from './components/pages/bludclart.tsx'
import { oblock } from './components/pages/oblock.tsx'

const Main = () => (
    <Router>
        <Route path="/" component={Landing} />
        <Route path="/bludclart" component={bludclart} />
        <Route path="/oblock" component={oblock}/>
        <Route path="*" component={fourofour} default={true} />
    </Router>
)

render(<Main />, document.getElementById('sawnofftingindapassy')!);