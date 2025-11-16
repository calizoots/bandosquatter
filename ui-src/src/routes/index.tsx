import { useEffect, useState } from 'preact/hooks'
import { HOSTNAME } from '../global';
import { useError } from '../components/error';
import killyder from '/realbadman.png';
import '../css/index.scss';

let Index = () => {
    let [state, setState] = useState({
        user: "",
        pass: "",
        loading: false,
        errors: [],
    })

    const updateState = <K extends keyof typeof state>(key: K, value: typeof state[K]) => {
        setState(prevState => ({
            ...prevState,
            [key]: value,
        }));
    };

    const { pushError } = useError();

    let getLogin = async () => {
        updateState("loading", true);
        try {
            const response = await fetch(`${HOSTNAME}/user/login`, {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({ username: state.user, password: state.pass }),
                credentials: "include",
            });

            const data = await response.json();

            if (data.status == "ok") {
                window.location.href = "/bludclart";
            } else {
                pushError(`${data.reason}`);
            }
        } catch (err) {
            pushError(`login failed. ${err}.`);
        } finally {
            updateState("loading", false);
        }
    };

    useEffect(() => {
        /* if (localStorage.getItem('token') != "") { */
        /* window.location.href = "/bludclart"; */
        /* } */
    })

    return (
        <div className="login-container">
            <img src={killyder} className="realskengman" />
            <input id="user" className="login-input" placeholder="username" onInput={e => updateState("user", e.currentTarget.value)} />
            <input id="pass" type="password" className="login-input" placeholder="password" onInput={e => updateState("pass", e.currentTarget.value)} />
            <button className="login-button" onClick={async _ => await getLogin()} disabled={state.loading} >
                {state.loading ? 'Logging in...' : 'Login'}
            </button>
        </div>
    );
};

export default Index;
