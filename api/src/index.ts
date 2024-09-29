import express from "express";
import clc from "cli-color";
import dotenv from "dotenv";
import env from "env-var";
import { PrismaClient } from "@prisma/client";
import cors from "cors";
import bodyParser from 'body-parser';
import busboy from 'connect-busboy';
import { setEnvironment, appPort, musicFolder, dfiBuffer, genie } from "./etc/state";
import { doThingsWithMusic } from "./helpers/helper";
import indexRouter from "./routes/indexRoutes";
import playlistRouter from "./routes/user/playlist";
import userRouter from "./routes/user/user";
import downloadRouter from "./routes/download/download";

const prisma = new PrismaClient();

const app = express();
app.use(bodyParser())
app.use(busboy({immediate: true}));

dotenv.config();

setEnvironment(
    env.get("port").required().asString(), 
    env.get("musicFolder").required().asString(), 
    env.get('jwtSecret').required().asString()
);

(async () => {
    /* Debug for playlists */

    //reset 2
    // try {
    //     await prisma.playlist.deleteMany({})
    // } catch {
    //     console.log(clc.bold('delete failed probably non existant'))
    // }

    // let me = await prisma.user.findUnique({
    //     where: {
    //         username: "cali"
    //     }, include: {
    //         musicFiles: true
    //     }
    // })

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

    app.use('/download', downloadRouter)

    app.use('/user', userRouter)
    
    app.use('/user/playlist', playlistRouter)

    app.use('/', indexRouter)

	app.listen(appPort, () => {
		console.log(
			clc.blueBright(
				`fucking god bine server running on http://dev.bmt:${appPort}`
			)
		);
	});
})();
