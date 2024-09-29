import { readFileSync } from 'fs';
import { Client } from 'genius-lyrics'
const defaultImageFile = "/Users/calizoots/alfie/curiousbine/music/api/src/etc/default/default.jpg";
export const dfiBuffer = readFileSync(defaultImageFile);
export const localurl = "http://192.168.8.116:3001";
export const genieApiKey = "e-40pEaFClFt_BhixboQUrEIxYL_f1hSWTbCfCMp6kklGDaEnAS3FcV7BMOzWt7o"
export const genie = new Client(genieApiKey)
export const credentials = {
    clientId: "72ee032d1ac94fc1b16e2071c6c24d86",
    clientSecret: "45b09e30302c4ec1b44175a1690e185b"
}
export const errorCodes = {
    wrongUserOrPass: {error: "wrong user or pass", code: 1},
    jwtDecodeFailed: {error: "jwt decode failed. stop fucking w my shi pussy", code: 2},
    noDataProvided: {error: "not enough data supplied", code: 3}
};

/* Environment */
export let appPort: string;
export let musicFolder: string;
export let jwtSecret: string;

export const setEnvironment = (port: string, musicdir: string, jwtPrivateShi: string) => {
    appPort = port;
    musicFolder = musicdir
    jwtSecret = jwtPrivateShi
}