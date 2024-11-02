# this is the bandosquatter

## word

THIS SHI ISNT DONE

i made this for a friend spontaiously he said some about it i said it was easy.
ahlie den got carried away made it an effort over a few weeks added serveral thing i use.
this my self no one could commericalise thi shi too slow the bundle size is very high.
I plan on making a way better version but I have other things to do now.
It works good on your local system but over the internet nuh nuh nuh.

## da feautres

1. download from spotify --> (specified you supply the credentials to spotdl)
2. ability to upload files to the server even though its only one by one.
3.local use? just download them.
4. a queue
5. playlists
6. volume
7. shuffle
8. search
9. and a nice interface
pretty standard things there
10. login system
11. profile pictures
your password are encrypted in the database

## u wan contribute

api needs rewrite in go. i decent at go could probably maintain it but not do a rewrite i aint that good ini

i can do stuff in react if someone wan to cheer my spirit give money

## screenshots

[*See*](Screenshots.md)

## commands to start

**download docker**

then run

```bash
docker-compose up
```

it has just occurred to me that i never told people how to add music manually

in the docker container named something like bandosquatter-api there is a directory that is created /usr/src/app/files/*username*/

in that dir you can paste that you can do that in a few ways

1. in the folder you cloned the repo it should have made the same folder in the ./api/files/*yourusername*/ add your files here restart the website. it is defaulted to run with nodemon so you can also hot reload the code in the docker container happy developing!!!!
3. or if you posess the knowledge create a docker volume mount it to the /usr/src/app/files/*yourusername*

go to

http://localhost:5173

login wid

1. default user: cali
2. defualt pass: zoots

love - s
