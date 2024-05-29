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

router.post('/new/client', async (req, res, next) => {
    const { name, surname, email, password } = req.body;
    // check if id exists in user base
    const clients = await requestDB(req, collections.clients.name, [
        {
            $project: {
                email: 1
            }
        }
    ]);
    // Is email aleready used ?
    if (
        clients.find(c => c.email === email)
    ) {
        answer.body = {
            error: "Email aleready exists !"
        }
        answer.statusCode = 400;
        req.answer = JSON.stringify(answer);
        next();
    } else {
        const cardId = await insertDB(req, collections.cartes.name, await generateCardInfos(req, "Visa"));
        const accountId = await insertDB(req, collections.comptes.name, await generateAccountInfos(req, "Courant"));
        const newUser = {
            name,
            surname, 
            email,
            cartes: [cardId],
            comptes: [accountId],
            password: await bcrypt.hash(password, saltRounds)
        };
        const userId = await insertDB(req, collections.clients.name, newUser);
        answer.body = {
            _id: userId,
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

router.post('/new/client/card', async (req, res, next) => {
    const { ident, name } = req.body;

    let cardId = (await insertDB(req, collections.cartes.name, await generateCardInfos(req, name))).insertedId;
    // get the account id and solde of sender
    query = [
        {
            $match: { _id: new ObjectId(ident)}
        },
        {
            $project: {
                cartes: 1
            }
        }
    ];
    const cards = (await requestDB(req, collections.clients.name, query))[0].cartes;
    cards.push(new ObjectId(cardId));
    answer.body = await updateDB(req, collections.clients.name, {
        id: new ObjectId(ident),
        body: {
            cartes: cards
        }
    });
    answer.statusCode = 201;
    req.answer = JSON.stringify(answer);
    next();
});

router.post('/new/client/account', async (req, res, next) => {

    const { ident, name } = req.body;
    const accountID = (await insertDB(req, collections.comptes.name, await generateAccountInfos(req, name))).insertedId;
    let accounts = (await requestDB(req, collections.clients.name, [
        {
            $match: { _id: new ObjectId(ident) }
        },
        {
            $project: {
                comptes: 1
            }
        }
    ]))[0].comptes;
    if (!accounts) accounts = [];
    accounts.push(new ObjectId(accountID));
    answer.body = await updateDB(req, collections.clients.name, {
        id: new ObjectId(ident),
        body: {
            comptes: accounts
        }
    });
    answer.statusCode = 201;
    req.answer = JSON.stringify(answer);
    next();
});

router.post('/client/virement', async (req, res, next) => {
    let { ident, amount, from_iban, to_iban, libelle } = req.body;
    if (to_iban === "OTHER"){
        to_iban = req.body.to_iban_other;
    }
    // get the account id and solde of sender
    query = [
        {
            $match: { _id: new ObjectId(ident)}
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
            $project: {
                _id: 1,
                accounts: 1
            }
        }
    ];
    let accountIds = (await requestDB(req, collections.clients.name, query))[0];
    const sender = accountIds.accounts.find(e => e.iban === from_iban);
    
    // get the account id and solde of receiver
    query = [
        {
            $match: { iban: to_iban }
        },
        {
            $project: {
                _id: 1,
                solde: 1,
            }
        }
    ];
    const receiver = (await requestDB(req, collections.comptes.name, query))[0];
    // set the amount of sender
    let rep = {}
    rep.sender = await updateDB(req, collections.comptes.name, {
        id: sender._id,
        body: {
            solde: sender.solde - Number(amount)
        }
    });
    // set the amount of receiver
    rep.receiver = await updateDB(req, collections.comptes.name, {
        id: receiver._id,
        body: {
            solde: Number(receiver.solde) + Number(amount)
        }
    });
    
    // write the operation
    const data = {
        _id: new ObjectId(),
        montant: Number(amount),
        compte: from_iban,
        emetteur: new ObjectId(ident),
        destination: to_iban,
        libelle,
        date: new Date()
    };
    rep.operation = await insertDB(req, collections.operations.name, data);
    answer.statusCode=200;
    answer.body = rep;
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

async function generateCardInfos(req, name){
    const currentDate = new Date();
    const expiracy = new Date(currentDate.getFullYear() + 3, currentDate.getMonth(), currentDate.getDate()).toLocaleDateString('en-GB');
    let numero, _id;
    let merged = [numero];
    const cards = await requestDB(req, collections.cartes.name, [
        {
            $project: {
                _id: 1,
                numero: 1
            }
        }
    ]);
    while (merged.length != 0){
        _id = new ObjectId();
        numero = generateCardNumber();
        merged = [];
        merged.push(cards.filter(c => 
            c._id === _id ||
            c.numero === numero
        )[0]);
        merged = merged.filter(v => v != undefined);
    }
    return {
        _id,
        validite: expiracy,
        numero,
        cvc: Math.floor(Math.random()*999),
        code: Math.floor(Math.random()*9999),
        name,
    };
}

async function generateAccountInfos(req, name) {
    let iban, _id;
    let merged= [iban];
    const accounts = await requestDB(req, collections.comptes.name, [
        {
            $project: {
                _id: 1,
                iban: 1
            }
        }
    ]);
    while (merged.length != 0){
        _id = new ObjectId();
        iban = generateIban();
        merged = [];
        merged.push(accounts.filter(a => 
            a.iban == iban ||
            a._id == _id
        )[0]);
        merged = merged.filter(v => v != undefined);
    }
    return {
        _id,
        solde: 0,
        name, 
        iban
    };
}
export default router;