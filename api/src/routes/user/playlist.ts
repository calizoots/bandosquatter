import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { errorCodes } from "../../etc/state";
import { AuthenticatedRequest, authenticatedShi } from "../../helpers/jwt";

const prisma = new PrismaClient();

const playlistRouter = Router();

playlistRouter.post("/get", authenticatedShi, async (req: AuthenticatedRequest, res) => {
    const user = await prisma.user.findUnique({
        where: {
            username: req.user.id
        }
    })
    if (user) {
        const playlists = await prisma.playlist.findMany({
            where: {
                ownerUsername: user.username
            },
            include: {
                songs: true
            }
        })
        res.json({ res: playlists })
    }
})

playlistRouter.post("/create", authenticatedShi, async (req: AuthenticatedRequest, res) => {
    let playlistTitle = req.body.title;
    if (playlistTitle) {
        const user = await prisma.user.findUnique({
            where: {
                username: req.user.id
            }
        })
        if (user) {
            try {
                let created = await prisma.playlist.create({
                    data: {
                        title: playlistTitle,
                        ownerUsername: user.username,
                    },
                    include: {
                        songs: true
                    }
                })
                res.json({ success: created })
            } catch {
                res.json({ error: "sum unexpect shi happened" })
            }
        } else {
            res.json({ error: "tf nig?" })
        }
    } else {
        res.json(errorCodes.noDataProvided)
    }
})

playlistRouter.post('/addsong', authenticatedShi, async (req: AuthenticatedRequest, res) => {
    let playlistName = req.body.playlist
    let songToAdd = req.body.song;
    if (songToAdd && playlistName) {
        try {
            let songId = Number(songToAdd)
            const playlist = await prisma.playlist.findUnique({
                where: {
                    ownerUsername: req.user.id,
                    title: playlistName
                },
                include: {
                    songs: true
                }
            })

            if (playlist && songId) {
                const updatedPlaylist = await prisma.playlist.update({
                    where: {
                        ownerUsername: req.user.id,
                        title: playlistName,
                    },
                    data: {
                        songs: {
                            connect: { id: songId }
                        }
                    }
                })
                res.json({ sucess: updatedPlaylist })
            }
        } catch (e) {
            console.log(e)
            res.json({ error: "provide a real number eegit" })
            return;
        }
    } else {
        res.json(errorCodes.noDataProvided)
    }
})

playlistRouter.post('/removesong', authenticatedShi, async (req: AuthenticatedRequest, res) => {
    console.log('called')
    let playlistName = req.body.playlist
    let songToAdd = req.body.song;
    if (songToAdd && playlistName) {
        try {
            let songId = Number(songToAdd)
            const playlist = await prisma.playlist.findUnique({
                where: {
                    ownerUsername: req.user.id,
                    title: playlistName
                },
                include: {
                    songs: true
                }
            })

            if (playlist && songId) {
                const updatedPlaylist = await prisma.playlist.update({
                    where: {
                        ownerUsername: req.user.id,
                        title: playlistName,
                    },
                    data: {
                        songs: {
                            disconnect: { id: songId }
                        }
                    }
                })
                res.json({ sucess: updatedPlaylist })
            }
        } catch (e) {
            console.log(e)
            res.json({ error: "provide a real number eegit" })
            return;
        }
    } else {
        res.json(errorCodes.noDataProvided)
    }
})

export default playlistRouter;