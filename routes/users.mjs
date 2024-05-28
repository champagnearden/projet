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
                as: 'accounts'
            }
        },
        {
            $lookup: {
                from: collections.cartes.name,
                localField: 'cartes',
                foreignField: '_id',
                as: 'cards'
            }
        },
        {
            $project: {
                _id: 1,
                name: 1,
                surname: 1,
                email: 1,
                cards: 1,
                accounts: 1
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

router.post('/new/client', async (req, res, next) => {
    const { name, surname, email, password, cartes } = req.body;
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
        ret.clients.find(client => client.email === email)
    ) {
        answer.body = {
            error: "Email aleready exists !"
        }
        answer.statusCode = 400;
        req.answer = JSON.stringify(answer);
        next();
    } else {
    // Is the ID aleready used ?
        let _id_account, _id_user, _id_card, number, iban;
        let merged = [_id_account];
        while (merged.length != 0){
            _id_account = new ObjectId();
            _id_user = new ObjectId();
            _id_card = new ObjectId();
            number = generateCardNumber();
            iban = generateIban();
            merged = [];
            merged.push(ret.clients.filter(client => 
                client._id === _id_account || 
                client._id === _id_user ||
                client.iban === iban
            )[0]);
            for (let client of ret.clients){
                merged.push(client.accounts.filter(v =>
                    v.iban === iban || 
                    v._id === _id_account
                )[0]);
                merged.push(client.cards.filter(v =>
                    v._id === _id_card ||
                    v.numero === number
                )[0]);
            }
            merged.push(ret.employes.filter(employe => 
                employe._id === _id_account || 
                employe._id === _id_user 
            )[0]);
            merged = merged.filter(v => v != undefined);
        }
        const newUser = {
            _id: _id_user,
            name,
            surname, 
            email,
            cartes: [_id_card],
            comptes: [_id_account],
            password: await bcrypt.hash(password, saltRounds)
        };

        // Add a current account and then the user with the id of the account

        const newAccount = {
            _id: _id_account, 
            solde: 0,
            name: "Courant", 
            iban: iban
        };
        await insertDB(req, collections.comptes.name, newAccount);

        const currentDate = new Date();
        const expiracy = new Date(currentDate.getFullYear() + 3, currentDate.getMonth(), currentDate.getDate()).toLocaleDateString('en-GB');

        const newCard = {
            _id: _id_card,
            validite: expiracy,
            numero: number,
            cvc: Math.floor(Math.random()*999),
            code: Math.floor(Math.random()*9999),
            name: "Visa",
        };
        await insertDB(req, collections.cartes.name, newCard);
        await insertDB(req, collections.clients.name, newUser);
        answer.body = {
            _id: _id_user,
        }
        answer.statusCode = 201;
    }
    req.answer = JSON.stringify(answer);
    next();
});

router.post('/new/employe', async (req, res, next) => {
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

router.route('/client/:id').get(async (req, res, next) => {
    query = [
        {
            $match: { _id: new ObjectId(req.params.id) }
        },
        {
            $lookup: {
                from: collections.comptes.name,
                localField: 'comptes',
                foreignField: '_id',
                as: 'accounts'
            }
        },
        {
            $lookup: {
                from: collections.cartes.name,
                localField: 'cartes',
                foreignField: '_id',
                as: 'cards'
            }
        },
        {
            $lookup: {
                from: collections.operations.name,
                localField: '_id',
                foreignField: 'compte',
                as: 'operations'
            }
        },
        {
            $project: {
                _id: 1,
                name: 1,
                surname: 1,
                email: 1,
                cards: 1,
                accounts: 1,
                operations: 1
            }   
        }
    ];
    answer.statusCode = 200;
    const result = await requestDB(req, collections.clients.name, query);
    answer.body = result;
    req.answer = JSON.stringify(answer);
    next();
})
.put(async (req, res, next) => {
    // TODO Verify informations
    if (req.body.accounts){
        let accounts=[];
        for (let client of req.body.accounts) {
            accounts.push(new ObjectId(client));
        }
        req.body.accounts = accounts;
    }
    if (req.body.cards){
        let cards=[];
        for (let client of req.body.cards) {
            cards.push(new ObjectId(client));
        }
        req.body.cards = cards;
    }
    const data = {
        id: new ObjectId(req.params.id),
        body: req.body
    };
    const rep = await updateDB(req, collections.clients.name, data);
    answer.statusCode = 200;
    answer.body = {
        message: rep
    }
    req.answer = JSON.stringify(answer);
    next();
})
.delete(async (req, res, next) => {
    const resp = await fetch(`${req.protocol}://${req.get('host')}/users/client/${req.params.id}`, {
        method: 'GET',
        headers: {
            'Authorization': req.headers['authorization']
        } 
    });
    const users = await resp.json();
    // TODO Delete the entry of a given user and dependent elements
    if (users[0]) {
        // User is a client
        // delete cards, accounts, operations, client
        const user = users[0];
        if (user.cards){
            answer.body.cards = [];
            for (let carte of user.cards){
                answer.body.cards.push(await deleteDB(req, collections.cartes.name, carte));
                
            }
        };
        if (user.accounts){
            answer.body.accounts = [];
            for (let account of user.accounts) {
                answer.body.accounts.push(await deleteDB(req, collections.comptes.name, account));
            }
        };
        if (user.operations){
            answer.body.operations = [];
            for(let op of user.operations) {
                answer.body.operations.push(await deleteDB(req, collections.operations.name, op));
            }
        };
        answer.body.client = await deleteDB(req, collections.clients.name, new ObjectId(req.params.id));
        answer.headers = 201;
        answer.body.message = `Successfully deleted client ${req.params.id} !`;
    } else {
        answer.statusCode = 400;
        answer.body = {
            message: "Inexistant user"
        }
    }
    req.answer = JSON.stringify(answer);
    next();
});

function generateIban(){
    let iban= 'FR'
    for (let i = 0; i < 25; i++) {
        iban += Math.floor(Math.random() * 10);
    }
    return iban;
}

function generateCardNumber(){
    let cardNumber = "";
    for (let i = 0; i < 4; i++) {
        for(let j = 0; j < 4; j++){
            cardNumber += Math.floor(Math.random() * 10);
        }
    }
    return cardNumber;
}
export default router;