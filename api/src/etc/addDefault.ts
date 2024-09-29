import { PrismaClient } from '@prisma/client'
import * as bcrypt from "bcrypt"
import dotenv from "dotenv";
import env from "env-var";

dotenv.config();

const files = env.get("musicFolder").required().asString();

const prisma = new PrismaClient();

const saltRounds = 10;
//alfie
let username = 'cali';
// let username = 'johnnie';
//spiceonsale
const passwordToHash = 'nigga'; 
// const passwordToHash = 'fent'; 

// Hash password with bcrypt and save to db
bcrypt.hash(passwordToHash, saltRounds, function(_err, hash) {
    // check error here
    // Then save password in DB with prisma
    (async() => {
        await prisma.user.create({
            data: {
                //... (give all other user data here)
                password: hash,
                username: username,       
                profilePicture: "https://i.pinimg.com/564x/bf/d2/8a/bfd28a52c107006fcfdb8d36ca80c1f3.jpg",
                musicFolder: `${files}/${username}`
            }
        })
        console.log('hello')
    })().catch( (prismaError) => {console.log(prismaError)} )

});
