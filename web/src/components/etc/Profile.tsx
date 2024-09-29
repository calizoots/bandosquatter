import { FunctionalComponent, JSX } from 'preact';
import "../scss/profile/profile.scss"

interface ProfileProps {
    profilePicture: string;
    isProfileVisible: boolean;
    onToggleProfileMenu: () => void;
    children: JSX.Element | JSX.Element[];
}

export const Profile: FunctionalComponent<ProfileProps> = ({ profilePicture, isProfileVisible, onToggleProfileMenu, children }) => {
    return (
        <div className={`profile ${isProfileVisible ? "profile-visible" : ""}`}>
            <img src={profilePicture} className="profile-picture" onClick={() => onToggleProfileMenu()} />
            {isProfileVisible ? (
                <div className="profile-menu">
                    {children}
                </div>
            ) : null}
        </div>
    )
}