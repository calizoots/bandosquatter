import { CreateNewElement } from "./utils.js";
CreateNewElement("div", document.documentElement, (container) => {
    let style = container.style;
    style.position = "absolute";
    style.bottom = "0";
    style.marginBottom = "5px";
    style.height = "1.5em";
    style.width = "100vw";
    style.textAlign = "right";
    CreateNewElement("span", container, (tag) => {
        tag.style.marginRight = "5px";
        tag.style.fontSize = "12px";
        tag.textContent = "@calizoots";
    });
});
