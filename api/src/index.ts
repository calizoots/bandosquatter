import clc from 'cli-color';
import express from 'express';
import dotenv from 'dotenv';
import env from 'env-var';
import { PrismaClient } from '@prisma/client';
import cors from 'cors';
import bodyParser from 'body-parser';
import busboy from 'connect-busboy';
import { setEnvironment, appPort, musicFolder, dfiBuffer, genie } from './etc/state';
import { doThingsWithMusic } from './helpers/helper';
import indexRouter from './routes/main';
import playlistRouter from './routes/user/playlist';
import userRouter from './routes/user/user';
import downloadRouter from './routes/download/download';
import { exit } from 'process';
import { readFileSync } from 'fs';
import https from 'https';

// const bucketName = 'music-ting';

const prisma = new PrismaClient();

const app = express();

app.use(bodyParser());
app.use(busboy({ immediate: true }));

dotenv.config();

let environment = env.get('NODE_ENV').required().asString();
if (environment !== 'prod' && environment !== 'dev') {
    console.log(clc.redBright('enter a correct environment'));
    exit();
}

setEnvironment(env.get('port').required().asString(), env.get('musicFolder').required().asString(), env.get('jwtSecret').required().asString());

(async () => {
    /* const filename = '/usr/src/app/files/cali/2muchfaith.mp3';
    let bucket = storage.bucket(bucketName);
    const res = await bucket.upload(filename, {
        destination: 'music',
        metadata: {
            contentType: 'audio/mpeg',
        },
    });
    console.log(res[0].metadata.mediaLink); */
    //const bucketFile = storage.bucket(bucketName).file(filename);
    //const filestream = createReadStream(filename);
    //const blobstream = bucketFile.createReadStream({
    //    resumable: false,
    //    contentType: 'audio/mpeg',
    //});
    //filestream
    //    .pipe(blobstream)
    //    .on('error', err => {
    //        console.error('Upload failed:', err);
    //    })
    //    .on('finish', () => {
    //        console.log(`File uploaded successfully to ${bucketName}/${fileName}`);
    //    });
    /* Debug for playlists */

    // reset 2
    // try {
    //     await prisma.playlist.deleteMany({})
    // } catch {
    //     console.log(clc.bold('delete failed probably non existant'))
    // }

    // hello

    // let me = await prisma.user.findUnique({
    //   where: {
    //     username: "cali",
    //   },
    //   include: {
    //     musicFiles: true,
    //   },
    // });

    // if (me?.musicFiles) {
    //     await prisma.playlist.create({
    //         data: {
    //             title: "pussy fam",
    //             picture: "https://i1.sndcdn.com/artworks-8jsxe6sKTKIzewWu-xWEG6w-t500x500.jpg",
    //             songs: {
    //                 connect: me.musicFiles.map(file => ({ id: file.id })),
    //             },
    //             ownerUsername: "cali",
    //         }
    //     })
    // }

    await doThingsWithMusic(dfiBuffer, genie, prisma);

    app.use(cors());
    app.use(express.static(musicFolder));

    // const spotify = new Spotify(credentials)

    app.use('/download', downloadRouter);

    app.use('/user', userRouter);

    app.use('/user/playlist', playlistRouter);

    app.use('/', indexRouter);

    if (environment == 'prod') {
        let opts = {
            key: readFileSync(env.get('httpsKey').required().asString()),
            cert: readFileSync(env.get('httpsCert').required().asString()),
        };
        https.createServer(opts, app).listen(appPort);
    } else {
        app.listen(appPort, () => {
            console.log(clc.blueBright(`fucking god bine server running on http://dev.bmt:${appPort}`));
        });
    }
})();
