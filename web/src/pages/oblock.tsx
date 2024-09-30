import Cookies from "js-cookie"
import axios from "axios"
import { useEffect, useState } from "preact/hooks"
import { withAuth } from "../methods/withAuth"
import { UserData } from "./bludclart"
import "./styles/oblock.scss"
import { hostname } from "../global/global"

let oblockpage = () => {
    let [userData, setUserData] = useState<UserData>()

    let [profilePictureInput, setProfilePictureInput] = useState("")
    let [usernameInput, setUsernameInput] = useState("")
    let [isPictureMenu, setPictureMenuVisiblity] = useState(false);
    let [isUserNameMenu, setUserNameMenuVisibility] = useState(false)

    useEffect(() => {
        let getUserData = async () => {
            const token = Cookies.get('token')
            const res = await axios.post(`${hostname}/user/get`, `jwt=${token}`)
            console.log(res.data)
            setUserData(res.data.user)
        }
        getUserData()
    }, [])

    return (
        <>
            <span className="settings-go-back" onClick={() => window.location.href = '/bludclart'}>go back?</span>
            <div className="oblock">
                {userData ? (
                    <div className="roach">
                        {isUserNameMenu ? (
                            <div className="settings-change-user-name-menu">
                                <span className="settings-change-user-name-menu-label">change username?</span>
                                <input placeholder="what to?" onInput={e => setUsernameInput(e.currentTarget.value)} className="settings-change-user-name-menu-input"/>
                                <button className="settings-change-user-name-menu-submit" onClick={async () => {
                                    if (usernameInput == "") {
                                        alert("enter summet at least like?")
                                    } else {
                                        let req = await axios.post(`${hostname}/user/changeusername`, `jwt=${Cookies.get('token')}&changeto=${usernameInput}`)
                                        if (req.data.success) {
                                            window.location.href = '/';
                                        } else {
                                            alert('fraud alert') 
                                        }
                                    }
                                }}>submit!</button>
                            </div>
                        ) : (<></>)}
                        <div className="goverment">
                            <div className="sugar" onClick={() => {setPictureMenuVisiblity(!isPictureMenu)}}>
                                <img src={userData.profilePicture} className="realsmoker"/>
                            </div>
                            <div className="bang" onClick={() => {setUserNameMenuVisibility(!isUserNameMenu)}}>
                                <span className="pop">{userData.username}</span>
                            </div>
                        </div>
                        {isPictureMenu ? (
                            <div className="settings-change-profile-picutre-menu">
                                <span className="settings-change-profile-picutre-menu-label">
                                    enter a sik picture m8
                                </span>
                                <input placeholder="yo img ere" className="settings-change-profile-picutre-menu-input" onInput={e => setProfilePictureInput(e.currentTarget.value)}/>
                                <button className="settings-change-profile-picutre-menu-submit" onClick={async () => {
                                    let data = await axios.post(`${hostname}/user/profilepicture`, `jwt=${Cookies.get('token')}&pfp=${profilePictureInput}`)
                                    console.log(data)
                                    window.location.reload()
                                }}>go</button>
                            </div>
                        ): (<></>)}
                    </div>
                ): (
                    <span style={{
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        width: "100vw",
                        height: "100vh"
                    }}>🙈Loading🙉</span>
                )}
            </div>
        </>
    )
}

export const oblock = withAuth(oblockpage)