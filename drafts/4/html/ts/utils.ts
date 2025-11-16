export let GetElementByID = (id: string, callback: (element: any) => void) => {
    const element = document.getElementById(id); 
    if (element !== null) {
        callback(element);
    } else {
        throw new Error(`element with id ${id} could not be found`);
    }
}

export function CreateNewElement<K extends keyof HTMLElementTagNameMap> (tag: K, toAppend: HTMLElement, callback: (element: HTMLElementTagNameMap[K]) => void): HTMLElementTagNameMap[K] {
    let thing = document.createElement(tag)
    toAppend.appendChild(thing);
    callback(thing);
    return thing
}

export function CreateNewElementPre<K extends keyof HTMLElementTagNameMap> (tag: K, toAppend: HTMLElement, callback: (element: HTMLElementTagNameMap[K]) => void): HTMLElementTagNameMap[K] {
    let thing = document.createElement(tag)
    toAppend.prepend(thing);
    callback(thing);
    return thing
}

export function CreateNewElementList<K extends keyof HTMLElementTagNameMap> (tag: K, howMany: number, toAppend: HTMLElement, callback: (element: HTMLElementTagNameMap[K][]) => void): HTMLElementTagNameMap[K][] {
    let list: HTMLElementTagNameMap[K][] = []
    for (let i = 0; i < howMany; i++) {
        let el =  document.createElement(tag);
        toAppend.appendChild(el)
        list.push(el)
    }
    callback(list);
    return list
}
