import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { answer } from '../models/answer.mjs'
import { collections, requestDB } from '../models/bdd.mjs';

const router = Router();

let query;
const saltRounds = Number(process.env.SALT_ROUNDS);

router.post('/client', async (req, res, next) => {
    const { username, password } = req.body;
    if ( username && password ) {
        query = [
            {
                $match: { email: username }
            },
            {
                $project: {
                    password: 1,
                    email: 1,
                    _id: 1
                }   
            }
        ];
        const clients = await requestDB(req, collections.clients.name, query);
        const bdd_hash = clients.length != 0 ? clients[0].password : "";
        if (await bcrypt.compare(password, bdd_hash)) {
            const token = jwt.sign({ userId: clients[0]._id, username: clients[0].email }, process.env.SECRET_KEY, { expiresIn: '1h' });
            answer.statusCode = 200;
            answer.body = {
                token,
                _id: clients[0]._id
            };
        } else {
            answer.statusCode = 400;
            answer.body = {
                error: "Invalid username or password"
            };
        }
    } else {
        answer.statusCode = 400;
        answer.body = {
            error: "Missing username or password"
        };
    }
    req.answer = JSON.stringify(answer);
    next();
});

router.post('client/forgotpassword', async (req, res, next) => {
    const { username, password } = req.body;
    query = [
        {
            $match: { email: username }
        },
        {
            $project: {
                password: 1,
                _id: 1
            }
        }
    ];
    const clients = await requestDB(req, collections.clients.name, query);
    if (clients.length != 0) {
        const hash = await bcrypt.hash(password, saltRounds);
        await updateDB(req, collections.clients.name, {
            _id: clients[0]._id,
            body: {
                password: hash
            }
        });
        const token = jwt.sign({ userId: clients[0]._id, username: clients[0].email }, process.env.SECRET_KEY, { expiresIn: '1h' });
        answer.statusCode = 200;
        answer.body = {
            token,
            _id: clients[0]._id
        };
    } else {
        answer.statusCode = 400;
        answer.body = {
            error: "Unknown email"
        };
    }
    req.answer = JSON.stringify(answer);
    next();
})

router.post('/employe', async (req, res, next) => {
    const { username, password } = req.body;
    if ( username && password ) {
        query = [
            {
                $match: { username: username }
            },
            {
                $project: {
                    password: 1,
                    _id: 1,
                    email: 1,
                    role: 1
                }   
            }
        ];
        const employes = await requestDB(req, collections.employes.name, query);
        const role = employes.length != 0 ? employes[0].role : "";
        const bdd_hash = employes.length != 0 ? employes[0].password : "";
        if (await bcrypt.compare(password, bdd_hash)) {
            const token = jwt.sign({ userId: employes[0]._id, username: employes[0].username }, process.env.SECRET_KEY, { expiresIn: '1h' });
            answer.statusCode = 200;
            answer.body = {
                token,
                _id: employes[0]._id,
                role
            };
        } else {
            answer.statusCode = 400;
            answer.body = {
                error: "Invalid username or password"
            };
        }
    } else {
        answer.statusCode = 400;
        answer.body = {
            error: "Missing username or password"
        };
    }
    req.answer = JSON.stringify(answer);
    next();
});

router.post('/employe/forgotpassword', async (req, res, next) => {
    const { username, password } = req.body;
    query = [
        {
            $match: { username: username }
        },
        {
            $project: {
                password: 1,
                _id: 1,
                email: 1
            }
        }
    ];
    const employes = await requestDB(req, collections.employes.name, query);
    if (employes.length != 0) {
        const hash = await bcrypt.hash(password, saltRounds);
        await updateDB(req, collections.employes.name, {
            _id: employes[0]._id,
            body: {
                password: hash
            }
        });
        const token = jwt.sign({ userId: employes[0]._id, username: employes[0].username }, process.env.SECRET_KEY, { expiresIn: '1h' });
        answer.statusCode = 200;
        answer.body = {
            token,
            _id: employes[0]._id
        };
    } else {
        answer.statusCode = 400;
        answer.body = {
            error: "Unknown username"
        };
    }
    req.answer = JSON.stringify(answer);
    next();
});

export default router;