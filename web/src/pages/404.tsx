import './styles/404.scss';

const fourofour = () => {
    return (
        <div className="lost-container">
            <span style={{ fontSize: '50px' }}>🫤</span>
            <span className="incon fourohfourtext">404</span>
            <span>🔮this shit dont fucking exist🔮</span>
            <span onClick={() => (window.location.href = '/')} className="fofgoback">
                go back?
            </span>
        </div>
    );
};

export default fourofour;
