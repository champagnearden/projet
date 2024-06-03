import { Router } from 'express';
import { answer } from '../models/answer.mjs'
import { requestDB, collections } from '../models/bdd.mjs';

const router = Router();
let query;
router.get('/', (req, res, next) => {
    query = [
        {
            $project: {
                _id: 1,
                name: 1,
                surname: 1,
                email: 1
            }   
        }
    ];
    let users = {
        clients: [],
        employes: []
    };
    requestDB(req, collections.employes.name, [{
        $project: {
            _id: 1,
            username: 1,
            name: 1,
            surname: 1,
            email: 1,
            roles: 1,
            clients: 1
        }
    }]).then( ret => {
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

router.get('/operations', async (req, res, next) => {
    answer.body = await requestDB(req, collections.operations.name, [
        {
            $lookup: {
                from: collections.clients.name,
                localField: "emetteur",
                foreignField: "_id",
                as: "emetteur"
            }
        },
        {
            $project: {
                date: 1,
                montant: 1,
                compte: 1,
                destination: 1,
                emetteur: {
                    surname: 1,
                    name: 1,
                    email: 1,
                },

            }
        }
    ]);
    answer.statusCode = 200;
    req.answer = JSON.stringify(answer);
    next();
});

export default router;