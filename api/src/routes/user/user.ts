import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { errorCodes } from "../../etc/state";
import { AuthenticatedRequest, authenticatedShi } from "../../helpers/jwt";

const prisma = new PrismaClient();

const userRouter = Router();

userRouter.post('/profilepicture', authenticatedShi, async (req: AuthenticatedRequest, res) => {
    let pfp = req.body.pfp;
    if (pfp) {
        const user = await prisma.user.findUnique({
            where: {
                username: req.user.id
            },
        })
        if (user) {
            let updated = await prisma.user.update({
                where: {
                    id: user.id
                },
                data: {
                    profilePicture: pfp
                }
            })
            res.json({ success: updated })
        } else {
            res.json({ error: "not found" })
        }
    } else {
        res.json(errorCodes.noDataProvided)
    }
})

userRouter.post("/getfiles", authenticatedShi, async (req: AuthenticatedRequest, res) => {
    let user = await prisma.user.findUnique({
        where: {
            username: req.user.id
        },
        include: {
            musicFiles: true
        }
    });
    if (user)
        res.json(user.musicFiles)
    else {
        res.status(400).json({ error: "something went fatally wrong" })
    }
});

userRouter.post('/changeusername', authenticatedShi, async (req: AuthenticatedRequest, res) => {
    let desiredUsername = req.body.changeto;
    if (desiredUsername) {
        const user = await prisma.user.findUnique({
            where: {
                username: req.user.id
            }
        })
        if (user) {
            try {
                let updated = await prisma.user.update({
                    where: {
                        id: user.id
                    },
                    data: {
                        username: desiredUsername
                    }
                })
                res.json({ success: updated })
            } catch {
                res.json({ error: "username already taken" })
            }
        } else {
            res.json({ error: "wth is that" })
        }
    } else {
        res.json(errorCodes.noDataProvided)
    }
})

userRouter.post('/get', authenticatedShi, async (req: AuthenticatedRequest, res) => {
    const user = await prisma.user.findUnique({
        where: {
            username: req.user.id
        },
    })
    if (user) {
        res.json({ user: user })
    } else {
        res.json({ error: "not found" })
    }
})

userRouter.post('/profilepicture', authenticatedShi, async (req: AuthenticatedRequest, res) => {
    let pfp = req.body.pfp;
    if (pfp) {
        const user = await prisma.user.findUnique({
            where: {
                username: req.user.id
            },
        })
        if (user) {
            let updated = await prisma.user.update({
                where: {
                    id: user.id
                },
                data: {
                    profilePicture: pfp
                }
            })
            res.json({ success: updated })
        } else {
            res.json({ error: "not found" })
        }
    } else {
        res.json(errorCodes.noDataProvided)
    }
})

export default userRouter;