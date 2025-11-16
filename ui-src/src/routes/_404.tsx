import '../css/_404.scss';

const fourofour = () => {
    return (
        <div className="lost-container">
            <span style={{ fontSize: '50px' }}>🫤</span>
            <span className="incon">404</span>
            <span>🔮this shit dont fucking exist🔮</span>
            <span onClick={() => window.history.back()} className="fofgoback">
                go back?
            </span>
        </div>
    );
};

export default fourofour;
