import { GetElementByID } from "./utils.js";
const BASE_WIDTH = 1440;
let MatchScaling = () => {
    const path = window.location.pathname;
    switch (path) {
        case "/":
            ScaleLoginUI();
            break;
        case "/app":
            break;
        default:
            break;
    }
};
let ScaleLoginUI = () => {
    let scale = BASE_WIDTH / window.innerWidth;
    if (scale < 1) {
        scale = window.innerWidth / BASE_WIDTH;
        scale *= 0.95;
    }
    else {
        scale *= 1.15;
    }
    GetElementByID("login", (el) => {
        el.style.transform = `scale(${scale.toFixed(1)})`;
    });
    document.body.style.transformOrigin = "center";
};
window.addEventListener('resize', MatchScaling);
window.addEventListener('load', MatchScaling);
