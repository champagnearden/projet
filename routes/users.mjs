import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { answer } from '../models/answer.mjs'
import { requestDB, insertDB, deleteDB, updateDB, collections } from '../models/bdd.mjs';
import { ObjectId } from 'mongodb';

const router = Router();
const saltRounds = Number(process.env.SALT_ROUNDS);
let query;
router.get('/', (req, res, next) => {
    query = [
        {
            $lookup: {
                from: collections.comptes.name,
                localField: 'comptes',
                foreignField: '_id',
                as: 'comptes'
            }
        },
        {
            $lookup: {
                from: collections.cartes.name,
                localField: 'cartes',
                foreignField: '_id',
                as: 'cartes'
            }
        },
        {
            $project: {
                _id: 1,
                name: 1,
                surname: 1,
                email: 1,
                cartes: 1,
                comptes: 1
            }   
        }
    ];
    let users = {
        clients: [],
        employes: []
    };
    requestDB(req, collections.employes.name, []).then( ret => {
        users.employes = ret;
    });
    requestDB(req, collections.clients.name, query)
        .then((userList) => {
            if ( userList.length === 0 ) {
                answer.statusCode = 204;
            } else {
                answer.statusCode = 200;
                users.clients = userList;
            }
            answer.body = users;
            req.answer = JSON.stringify(answer);
            next();
        })
        .catch((err) => {
            answer.statusCode = 500;
            answer.body = err;
            req.answer = JSON.stringify(answer);
            next();
        });
});


router.post('/employe/new', async (req, res, next) => {
    const { name, surname, email, role, clients, password } = req.body;
    // check if id exists in user base
    const rep = await fetch(`${req.protocol}://${req.get('host')}/users/`, {
        method: 'GET',
        headers: {
            'Authorization': req.headers['authorization']
        } 
    });
    const ret = await rep.json();
    // Is email aleready used ?
    if (
        ret.employes.find(employe => employe.email === email)
    ) {
        answer.body = {
            error: "Email aleready exists !"
        }
        answer.statusCode = 400;
    } else {
        // Is the ID aleready used ?
        let _id;
        let merged = [_id];
        while (merged.length != 0){
            _id = new ObjectId();
            merged = [];
            merged.push(ret.clients.filter(client => client._id === _id)[0]);
            merged.push(ret.employes.filter(employe => employe._id === _id)[0]);
            merged = merged.filter(v => v != undefined);
        }
        // Is the username aleready used ?
        let username;
        merged = [username];
        while (merged.length != 0){
            username = String(Math.floor(Math.random()*9_000_000_000)+1_000_000_000);
            merged = [];
            merged.push(ret.employes.filter(employe => employe.username === username)[0]);
            merged = merged.filter(v => v != undefined);
        }
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
        const resp = await insertDB(req, collections.employes.name, newUser);
        answer.body = {
            _id,
        }
        answer.statusCode = 201;
    }
    req.answer = JSON.stringify(answer);
    next();
});

router.route('/employe/:id').get(async (req, res, next) => {
    query = [
        {
            $match: { _id: new ObjectId(req.params.id) }
        },
        {
            $lookup: {
                from: collections.clients.name,
                localField: 'clients',
                foreignField: '_id',
                as: 'accounts'
            }
        },
        {
            $project: {
                username: 1,
                name: 1,
                surname: 1,
                email: 1,
                role: 1,
                accounts: 1
            }
        }
    ];
    answer.statusCode = 200;
    const result = await requestDB(req, collections.employes.name, query);
    answer.body = result;
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
    const data = {
        id: new ObjectId(req.params.id),
        body: req.body
    };
    const rep = await updateDB(req, collections.employes.name, data);
    answer.statusCode = 200;
    answer.body = {
        message: rep
    }
    req.answer = JSON.stringify(answer);
    next();
})
.delete(async (req, res, next) => {
    const rep = await fetch(`${req.protocol}://${req.get('host')}/users/employe/${req.params.id}`, {
        method: 'GET',
        headers: {
            'Authorization': req.headers['authorization']
        } 
    });
    const users = await rep.json();
    // TODO Delete the entry of a given user and dependent elements
    if (users[0]) {
        const user = users[0];
        // User is an employee
        // delete employee
        const ret = await deleteDB(req, collections.employes.name, new ObjectId(req.params.id));
        answer.statusCode = 201;
        answer.body = {
            message: ret
        }
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