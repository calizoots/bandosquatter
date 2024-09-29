import NodeID3 from "node-id3";
import path from "path";
import { localurl } from "../etc/state";
import { Prisma, PrismaClient } from "@prisma/client";
import { DefaultArgs } from "@prisma/client/runtime/library";
import fs from "fs";
import { Client } from "genius-lyrics";

export const parseMp3 = (pathToFile: string, replacementImage: Buffer, username:string) => {
    let file = path.basename(pathToFile)
    if (file == ".DS_Store") {
        return;
    }
    let meta = NodeID3.read(pathToFile)
    meta.title = meta.title || file
    meta.artist = meta.artist || "bangingjuj"
    meta.album = meta.album || "dailyzoots"
    let albumImg;
    if (meta.image && typeof meta.image !== 'string') {
        albumImg = meta.image.imageBuffer
    } else {
        albumImg = replacementImage;
    }
    let albumImgEncoded = Buffer.from(albumImg).toString('base64')
    let dataUrl = `data:image/jpeg;base64,${albumImgEncoded}`
    return {
        fileName: file,
        title: meta.title,
        album: meta.album,
        artist: meta.artist,
        albumArt: dataUrl,
        url: `${localurl}/${username}/${file}`,
    }
}

export const doThingsWithMusic = async (dfiBuffer: Buffer, genie: Client, prisma: PrismaClient<Prisma.PrismaClientOptions, never, DefaultArgs>) => {
    type easier = {
        username: string
        musicFolder: string
    }

    let userdata: easier[] = []

    let getUsers = await prisma.user.findMany()
    
    for (let i = 0; i < getUsers.length; i++) {
        let mf = getUsers[i].musicFolder
        let us = getUsers[i].username

        if (!fs.existsSync(mf)) {
            fs.mkdir(mf, () => {console.log("created music dir!")})
        }

        userdata.push({
            username: us,
            musicFolder: mf,
        })
    }

    for (let x = 0; x < userdata.length; x++) {
        fs.readdirSync(userdata[x].musicFolder).forEach(async (file) => {
            let test = await prisma.musicFile.findFirst({
                where: {
                    fileName: file,
                    ownerUsername: userdata[x].username
                },
            });
            if (test) {
                return;
            } else {
                try {
                    let parsedFileName = path.parse(file).name
                    const res = await genie.songs.search(parsedFileName)
                    if (parsedFileName === res[0].title) {
                        console.log(res[0].title)
                    }
                    let meta = parseMp3(`${userdata[x].musicFolder}/${file}`, dfiBuffer, userdata[x].username)
                    if (meta !== undefined) {
                        await prisma.musicFile.create({
                            data: {
                                title: meta.title,
                                album: meta.album,
                                albumArt: meta.albumArt,
                                artist: meta.artist,
                                fileName: meta.fileName,
                                url: meta.url,
                                ownerUsername: userdata[x].username,
                            }
                        })
                    }
                } catch (e) {
                    console.log(`error parsing files: ${e}`)
                }
            }
        })
    }
    return userdata;
}
