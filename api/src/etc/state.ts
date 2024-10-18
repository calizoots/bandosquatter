import { readFileSync } from 'fs';
import { Storage } from '@google-cloud/storage';
import { Client } from 'genius-lyrics';
const defaultImageFile = '/usr/src/app/src/etc/default/default.jpg';
export const dfiBuffer = readFileSync(defaultImageFile);
export const localurl = 'http://localhost:3001';
// ion care have this shit for mf free ill make a new one fn
// 🤡📸
export const genieApiKey = 'e-40pEaFClFt_BhixboQUrEIxYL_f1hSWTbCfCMp6kklGDaEnAS3FcV7BMOzWt7o';
export const genie = new Client(genieApiKey);
export const errorCodes = {
    wrongUserOrPass: { error: 'wrong user or pass', code: 1 },
    jwtDecodeFailed: {
        error: 'jwt decode failed. stop fucking w my shi pussy',
        code: 2,
    },
    noDataProvided: { error: 'not enough data supplied', code: 3 },
};
// this shit tfuddy tfuddy mine tho nig
export const storage = new Storage({
    projectId: 'lyrics-434906',
    keyFilename: '/usr/src/app/googlekeyfilenat.json',
});
/* Environment */
export let appPort: string;
export let musicFolder: string;
export let jwtSecret: string;

export const setEnvironment = (port: string, musicdir: string, jwtPrivateShi: string) => {
    appPort = port;
    musicFolder = musicdir;
    jwtSecret = jwtPrivateShi;
};
