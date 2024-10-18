import { Router } from 'express';
import { AuthenticatedRequest, authenticatedShi, generateAccessToken } from '../helpers/jwt';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { errorCodes, jwtSecret, dfiBuffer, genie } from '../etc/state';
import multer from 'multer';
import fs from 'fs';
import { doThingsWithMusic } from '../helpers/helper';
const prisma = new PrismaClient();
const upload = multer();

const indexRouter = Router();

indexRouter.post('/verify', authenticatedShi, (req: AuthenticatedRequest, res) => {
    console.log(req.user);
    res.json({ jwt: req.user });
});

indexRouter.post('/login', async (req, res) => {
    try {
        let username = req.body.user;
        let password = req.body.pass;
        if (username && password) {
            const user = await prisma.user.findUnique({
                where: {
                    username,
                },
            });
            if (user) {
                const match = await bcrypt.compare(password, user.password);
                if (match) {
                    let jwtt = generateAccessToken(username, jwtSecret);
                    res.json({ jwt: jwtt });
                } else {
                    res.json(errorCodes.wrongUserOrPass);
                }
            } else {
                res.json(errorCodes.wrongUserOrPass);
            }
        }
    } catch (e) {
        console.log(e);
        res.json(errorCodes.noDataProvided);
    }
});

indexRouter.post('/upload', upload.single('file'), authenticatedShi, async (req: AuthenticatedRequest, res) => {
    let user = await prisma.user.findUnique({
        where: {
            username: req.user.id,
        },
        include: {
            musicFiles: true,
        },
    });
    if (user) {
        req.pipe(req.busboy);
        if (req.file) {
            fs.writeFile(`${user.musicFolder}/${req.file.originalname}`, req.file?.buffer, async err => {
                if (err) {
                    console.error('error writing file:', err);
                    return res.status(500).json({ message: 'failed to save' });
                }

                await doThingsWithMusic(dfiBuffer, genie, prisma);
                console.log(`mp3 saved to ${req.file?.originalname}`);
                res.json({ message: 'upload success' });
            });
        }
    }
});

indexRouter.get('/', (_req, res) => {
    res.send('sum stuff');
});

export default indexRouter;

