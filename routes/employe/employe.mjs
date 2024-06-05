import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { answer } from '../../models/answer.mjs'
import { requestDB, insertDB, deleteDB, updateDB, collections } from '../../models/bdd.mjs';
import { ObjectId } from 'mongodb';

const router = Router();
const saltRounds = Number(process.env.SALT_ROUNDS);
let query;

router.get('/', async (req, res, next) => {
    query = [
        {
            $lookup: {
                from: collections.clients.name,
                localField: 'clients',
                foreignField: '_id',
                as: 'clients'
            }
        },
        {
            $project: {
                username: 1,
                name: 1,
                surname: 1,
                email: 1,
                role: 1,
                clients: {
                    surname: 1,
                    name: 1,
                    email: 1,
                    comptes: 1,
                    cartes: 1
                }
            }
        }
    ];
    answer.body = await requestDB(req, collections.employes.name, query);
    answer.statusCode = 200;
    req.answer = JSON.stringify(answer);
    next();
});

router.post('/new', async (req, res, next) => {
    const { name, surname, email, role, clients, password } = req.body;
    // check if id exists in user base

    const employes = await requestDB(req, collections.employes.name, [{
        $project: {
            _id: 1,
            email: 1,
            username: 1
        }
    }]);
    // Is email aleready used ?
    if (
        employes.find(employe => employe.email === email)
    ) {
        answer.body = {
            error: "Email aleready exists !"
        }
        answer.statusCode = 400;
    } else {
        // Is the ID aleready used ?
        let _id;
        let merged;
        do {
            _id = new ObjectId();
            merged = [];
            merged.push(employes.filter(employe => employe._id == _id)[0]);
            merged = merged.filter(v => v != undefined);
        } while (merged.length != 0)
        // Is the username aleready used ?
        let username;
        do {
            username = String(Math.floor(Math.random()*9_000_000_000)+1_000_000_000);
            merged = [];
            merged.push(employes.filter(employe => employe.username === username)[0]);
            merged = merged.filter(v => v != undefined);
        } while (merged.length != 0)
        const newUser = {
            _id,
            username,
            name,
            surname,
            email,
            role,
            clients,
            password: await bcrypt.hash(password, saltRounds)

        }
        answer.body = await insertDB(req, collections.employes.name, newUser);
        answer.statusCode = 201;
    }
    req.answer = JSON.stringify(answer);
    next();
});

router.route('/:id').get(async (req, res, next) => {
    query = [
        {
            $match: { _id: process.env.MONGOPASSWORD ? req.params.id : new ObjectId(req.params.id) }
        },
        {
            $lookup: {
                from: collections.clients.name,
                localField: 'clients',
                foreignField: '_id',
                as: 'clients'
            }
        },
        {
            $project: {
                username: 1,
                name: 1,
                surname: 1,
                email: 1,
                role: 1,
                clients: {
                    surname: 1,
                    name: 1,
                    email: 1,
                    comptes: 1,
                    cartes: 1
                }
            }
        }
    ];
    answer.statusCode = 200;
    answer.body = await requestDB(req, collections.employes.name, query);
    req.answer = JSON.stringify(answer);
    next();
})
.put(async (req, res, next) => {
    // TODO Verify informations
    if (req.body.clients){
        let clients=[];
        for (let client of req.body.clients) {
            clients.push(new ObjectId(client));
        }
        req.body.clients = clients;
    }
    const rep = await updateDB(req, collections.employes.name, {
        body: req.body
    });
    answer.statusCode = 200;
    answer.body = {
        message: rep
    }
    req.answer = JSON.stringify(answer);
    next();
})
.delete(async (req, res, next) => {
    const users = await requestDB(req, collections.employes.name, [{
        $match: { _id: process.env.MONGOPASSWORD ? req.params.id : new ObjectId(req.params.id) }
    }], true);
    if (users.length > 0) {
        // User is an employee
        // delete employee
        answer.body = await deleteDB(req, collections.employes.name, new ObjectId(req.params.id));
        answer.statusCode = 201;
    } else {
        answer.statusCode = 400;
        answer.body = {
            message: "Inexistant user"
        }
    }
    req.answer = JSON.stringify(answer);
    next();
});

export default router;