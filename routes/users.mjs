import { Router } from 'express';
import { answer } from '../models/answer.mjs'
import { requestDB, collections } from '../models/bdd.mjs';

const router = Router();
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

export default router;