import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import env from 'env-var';

dotenv.config();

const files = env.get('musicFolder').required().asString();

const prisma = new PrismaClient();

const saltRounds = 10;
let username = 'cali';
const passwordToHash = 'zoots';

bcrypt.hash(passwordToHash, saltRounds, function (_err, hash) {
    (async () => {
        try {
            await prisma.user.create({
                data: {
                    password: hash,
                    username: username,
                    profilePicture: 'https://i.pinimg.com/564x/bf/d2/8a/bfd28a52c107006fcfdb8d36ca80c1f3.jpg',
                    musicFolder: `${files}/${username}`,
                },
            });
            console.log('done!!!');
        } catch {
            console.log('user already exists');
        }
    })().catch(prismaError => {
        console.log(prismaError);
    });
});
