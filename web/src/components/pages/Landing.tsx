import '../scss/Landing.scss'
import killyder from '../../assets/realbadman.png'
import { useState } from 'preact/hooks'
import axios from 'axios'
import Cookies from 'js-cookie'
import { route } from 'preact-router'
import { hostname } from '../etc/global'

export let Landing = () => {
    let [user, setUser] = useState("")
    let [pass, setPass] = useState("")

    let getLogin = async () => {
        let request = await axios.post(`${hostname}/login`, `user=${user}&pass=${pass}`);
        if (request.data.jwt) {
            Cookies.set('token', request.data.jwt)
            route('/bludclart', true)
        } else {
            alert(request.data.error)
        }
    }

    return (
        <div className="login-container">
            <img src={killyder} className="realskengman" />
            <input id="user" className="login-input" placeholder="username" onInput={e => setUser(e.currentTarget.value)} />
            <input id="pass" type="password" className="login-input" placeholder="password" onInput={e => setPass(e.currentTarget.value)} />
            <button className="login-button" onClick={async _ => await getLogin()}>login</button>
        </div>
    )
}
