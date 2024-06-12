import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { answer } from '../../models/answer.mjs'
import { requestDB, insertDB, deleteDB, updateDB, collections } from '../../models/bdd.mjs';
import { ObjectId } from 'mongodb';

const router = Router();
const saltRounds = Number(process.env.SALT_ROUNDS);
let query;
answer.body = {};

router.get('/', async (req, res, next) => {
    answer.body = await requestDB(req, collections.clients.name, [
        {
            $project: {
                _id: 1,
                name: 1,
                surname: 1,
                email: 1
            }
        }
    ]);
    answer.statusCode = 200;
    req.answer = JSON.stringify(answer);
    next();
});

router.post('/new', async (req, res, next) => {
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
        const userId = await insertDB(req, collections.clients.name, {
            name,
            surname, 
            email,
            cartes: [cardId],
            comptes: [accountId],
            password: await bcrypt.hash(password, saltRounds)
        });
        answer.body = {
            _id: userId,
        }
        answer.statusCode = 201;
    }
    req.answer = JSON.stringify(answer);
    next();
});

router.post('/new/card', async (req, res, next) => {
    const { ident, name } = req.body;
    const cardId = (await insertDB(req, collections.cartes.name, await generateCardInfos(req, name))).insertedId;
    // get the account id and solde of sender
    const _id = process.env.MONGOPASSWORD ? ident : new ObjectId(ident);
    query = [
        {
            $match: { _id }
        },
        {
            $project: {
                cartes: 1
            }
        }
    ];
    const cartes = (await requestDB(req, collections.clients.name, query))[0];
    const newCard = new ObjectId(cardId);
    if (!cartes.cartes) cartes.cartes = [];
    cartes.cartes.push(newCard);
    answer.body = await updateDB(req, collections.clients.name, {
        _id,
        body: {
            cartes
        }
    });
    answer.statusCode = 201;
    req.answer = JSON.stringify(answer);
    next();
});

router.post('/new/account', async (req, res, next) => {
    const { ident, name } = req.body;
    // verify that sender is a client
    const _id = process.env.MONGOPASSWORD ? ident : new ObjectId(ident);
    // get the account id and solde of sender
    query = [
        {
            $match: { _id }
        },
        {
            $project: {
                comptes: 1
            }
        }
    ];
    const isClient = (await requestDB(req, collections.clients.name, query))[0];
    if (!isClient) {
        answer.body = {
            error: "Unable to find your account"
        }
        answer.statusCode = 400;
    } else {
        const accountID = (await insertDB(req, collections.comptes.name, await generateAccountInfos(req, name))).insertedId;
        const accounts = (await requestDB(req, collections.clients.name, [
            {
                $match: { _id }
            },
            {
                $project: {
                    comptes: 1
                }
            }
        ]))[0];
        if (!accounts.comptes) accounts.comptes = [];
        accounts.comptes.push(new ObjectId(accountID));
        answer.body = await updateDB(req, collections.clients.name, {
            _id: process.env.MONGOPASSWORD ? ident : new ObjectId(ident),
            body: {
                comptes: accounts.comptes
            }
        });
        answer.statusCode = 201;
    }
    req.answer = JSON.stringify(answer);
    next();
});

router.put('/new/beneficiaire/:id', async (req, res, next) => {
    const { name, surname, iban, account } = req.body;
    // get the account id and solde of sender
    const _id = process.env.MONGOPASSWORD ? req.params.id : new ObjectId(req.params.id);
    query = [
        {
            $match: { _id }
        },
        {
            $project: {
                beneficiaires: 1
            }
        }
    ];
    const user = (await requestDB(req, collections.clients.name, query))[0];
    if (!user.beneficiaires) user.beneficiaires = [];
    user.beneficiaires.push({
        name,
        surname,
        account,
        iban
    });
    answer.body = await updateDB(req, collections.clients.name, {
        _id,
        body: user
    });
    answer.statusCode = 201;
    req.answer = JSON.stringify(answer);
    next();
});

router.delete('/beneficiaire/:id', async (req, res, next) => {
    const _id = process.env.MONGOPASSWORD ? req.user.userId : new ObjectId(req.user.userId);
    // get the account id and solde of sender
    query = [
        {
            $match: { _id }
        },
        {
            $project: {
                beneficiaires: 1
            }
        }
    ];
    const user = (await requestDB(req, collections.clients.name, query))[0];
    if (!user && !user.beneficiaires) user.beneficiaires = [];
    if (user.beneficiaires.length > Number(req.params.id)) {
        user.beneficiaires.splice(Number(req.params.id), 1);
        answer.body = await updateDB(req, collections.clients.name, {
            _id,
            body: user
        });
        answer.statusCode = 201;
    } else {
        answer.body = {
            error: "Beneficiaire not found"
        }
        answer.statusCode = 400;
    }
    req.answer = JSON.stringify(answer);
    next();
});

router.post('/virement', async (req, res, next) => {
    const { ident, amount, from_iban, libelle } = req.body;
    let to_iban = req.body.to_iban;
    if (to_iban === "OTHER"){
        to_iban = req.body.to_iban_other;
    }
    answer.body = {};
    // get the account id and solde of sender
    const _id = process.env.MONGOPASSWORD ? ident : new ObjectId(ident);
    query = [
        {
            $match: { _id }
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
    const accountIds = (await requestDB(req, collections.clients.name, query))[0];
    if (!accountIds) {
        answer.body = {
            error: "Unable to find you"
        }
        answer.statusCode = 400;
    } else {
        const sender = accountIds.accounts.find(e => e.iban === from_iban);
        if (!sender) {
            answer.body = {
                error: "Could not find selected account"
            }
            answer.statusCode = 400;
        } else {
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
            if (!receiver) {
                answer.body = {
                    error: "Receiver not found"
                }
                answer.statusCode = 400;
            } else {
                answer.body.sender = await updateDB(req, collections.comptes.name, {
                    _id: sender._id,
                    body: {
                        solde: sender.solde - Number(amount)
                    }
                });
                // set the amount of receiver
                answer.body.receiver = await updateDB(req, collections.comptes.name, {
                    _id: receiver._id,
                    body: {
                        solde: Number(receiver.solde) + Number(amount)
                    }
                });
                
                // write the operation
                answer.body.operation = await insertDB(req, collections.operations.name, {
                    _id: new ObjectId(),
                    montant: Number(amount),
                    compte: from_iban,
                    emetteur: _id,
                    destination: to_iban,
                    libelle,
                    date: new Date()
                });
                answer.statusCode=200;
            }
        }
    }
    req.answer = JSON.stringify(answer);
    next();
});

router.route('/:id').get(async (req, res, next) => {
    const _id = process.env.MONGOPASSWORD ? req.params.id : new ObjectId(req.params.id);
    answer.statusCode = 200;
    answer.body = await requestDB(req, collections.clients.name, [
        {
            $match: { _id }
        },
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
                as: 'cards'
            }
        },
        {
            $lookup: {
                from: collections.operations.name,
                localField: '_id',
                foreignField: 'emetteur',
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
                comptes: 1,
                beneficiaires: 1,
                operations: {
                    montant: 1,
                    compte: 1,
                    destination: 1,
                    libelle: 1,
                    date: 1
                }
            }
        }
    ]);
    req.answer = JSON.stringify(answer);
    next();
})
.put(async (req, res, next) => {
    // TODO Verify informations
    const _id = process.env.MONGOPASSWORD ? req.params.id : new ObjectId(req.params.id);
    let newElements=[];
    if (req.body.accounts){
        for (let account of req.body.accounts) {
            newElements.push(new ObjectId(account));
        }
        req.body.accounts = newElements;
    }
    newElements=[];
    if (req.body.cards){
        for (let card of req.body.cards) {
            newElements.push(new ObjectId(card));
        }
        req.body.cards = newElements;
    }
    await updateDB(req, collections.clients.name, {
        _id,
        body: req.body
    }).then(resp => {
        answer.body = resp;
        answer.statusCode = 201;
    }).catch(e => {
        answer.statusCode = 400;
        answer.body = {
            error: e.errorResponse.errmsg
        }
    });
    req.answer = JSON.stringify(answer);
    next();
})
.delete(async (req, res, next) => {
    const _id = process.env.MONGOPASSWORD ? req.params.id : new ObjectId(req.params.id);
    const users = await requestDB(req, collections.clients.name, [
        {
            $match: { _id }
        },
        {
            $project: {
                cards: 1,
                accounts: 1,
                operations: 1,
                client: 1
            }
        }
    ]);
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
        answer.body.client = await deleteDB(req, collections.clients.name, _id);
        answer.statusCode = 201;
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

function generateIban(){
    let iban= 'FR'
    for (let i = 0; i < 25; i++) {
        iban += Math.floor(Math.random() * 10);
    }
    return iban.toUpperCase();
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