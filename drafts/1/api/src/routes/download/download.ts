import express from "express";
import { PrismaClient } from "@prisma/client";
import { spawn } from "child_process";
import { dfiBuffer, genie } from "../../etc/state";
import { doThingsWithMusic } from "../../helpers/helper";
import { AuthenticatedRequest, authenticatedShi } from "../../helpers/jwt";

const prisma = new PrismaClient();

const downloadRouter = express();

downloadRouter.post("/spotify", authenticatedShi, async (req: AuthenticatedRequest, res) => {
    let url = req.body.url;

    let user = await prisma.user.findUnique({
        where: {
            username: req.user.id
        },
        include: {
            musicFiles: true
        }
    });

    if (user) {
        let downloader = spawn("spotdl", ["download", `${url}`], { cwd: user.musicFolder })
        downloader.stdout.on('data', (data) => {
            console.log(`downloader stdout:\n${data}`);
        });

        downloader.stderr.on('data', (data) => {
            console.error(`downloader stderr:\n${data}`);
        });

        downloader.on('close', async () => {
            console.log("!finished!")
            await doThingsWithMusic(dfiBuffer, genie, prisma)
            res.json({ message: 'successfull' })
        })

        // let filename = path.join(user.musicFolder, data.name + '.mp3')
        // console.log('Downloading: ', data.name, 'by:', data.artists.join(' '))
        // let song = await spotify.downloadTrack(url)
        // fs.writeFileSync(filename, song)
    }
})

export default downloadRouter;