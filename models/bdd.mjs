import { answer } from "./answer.mjs";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config('../.env');

async function requestDB(req, collection, query) {
    try {
        req.db = mongo.db(process.env.TABLE_NAME);
        const c = req.db.collection(collection);
        return await c.aggregate(query).toArray((err, result) => {
            if (err) {
                console.log("Error with the query: ", err);
                throw err;
            } else {
                return result;
            }
        });
    } catch (err) {
        console.error('Error fetching data from MongoDB:', err);
        return err;
    }
}

async function insertDB(req, collection, data) {
    req.db = mongo.db(process.env.TABLE_NAME);
    return req.db.collection(collection).insertOne(data);
}

async function deleteDB(req, collection, _id) {
    req.db = mongo.db(process.env.TABLE_NAME);
    return req.db.collection(collection).deleteOne({ _id });
}

async function updateDB(req, collection, data) {
    req.db = mongo.db(process.env.TABLE_NAME);
    return req.db.collection(collection).updateOne({ _id: data._id }, { $set: data.body });
}

async function connectDB(req, res, next) {
    await mongo.connect()
    .then(() => {
        console.log("Connected to MongoDB");
    })
    .catch(err => {
        console.error('Error connecting to MongoDB:', err);
        answer.statusCode = 500;
        answer.body = err;
        req.answer = JSON.stringify(answer);
    });
    next();
}

const collections = {
    otp: {
        name: "otp",
        fields: {
            _id: "ObjectId",
            otp: "Number",
            username: "String"
        }
    },
    cartes: {
        name: "cartes_bancaires",
        fields: {
            _id: "ObjectId",
            validite: "String",
            numero: "String",
            cvc: "String",
            code: "String",
            name: "String",
            blocked: "Boolean"
        }
    },
    clients: {
        name: "clients",
        fields: {
            _id: "ObjectId",
            name: "String",
            surname: "String",
            email: "String",
            password: "String",
            cartes: "ObjectId[]", 
            comptes: "ObjectId[]",
            beneficiaires: "String[]"
        }
    },
    comptes: {
        name: "comptes",
        fields: {
            _id: "ObjectId", 
            solde: "Integer",
            name: "String",
            iban: "String"
        }
    },
    employes: {
        name: "employes",
        fields: {
            _id: "ObjectId",
            username: "String",
            name: "String",
            surname: "String",
            email: "String",
            password: "String",
            role: "String",
            clients: "ObjectId[]"
        }
    },
    operations: {
        name: "operations",
        fields: {
            _id: "ObjectId",
            date: "String",
            montant: "String",
            destination: "String",//compte de destination
            emetteur: "ObjectId",//compte émettant
            libelle: "String",
            compte: "String"
        }
    }
}
let url = 'mongodb://';
if (process.env.MONGOPASSWORD){
    url += `${process.env.MONGOUSER}:${process.env.MONGOPASSWORD}@`;
}
url+=`${process.env.MONGOHOST}:${process.env.MONGOPORT}`;
const mongo = new MongoClient(url);

export { requestDB, connectDB, insertDB, deleteDB, updateDB, collections };