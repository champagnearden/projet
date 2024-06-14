import express, { urlencoded, json } from 'express';
import dotenv from 'dotenv';
import bodyParser from 'body-parser';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import userRouter from './routes/users.mjs';
import loginRouter from './routes/login.mjs';
import clientRouter from './routes/client/client.mjs';
import employeRouter from './routes/employe/employe.mjs'
import { connectDB, requestDB, collections } from './models/bdd.mjs';
import { answer } from './models/answer.mjs';
import { transporter, mailOptions } from './models/email.mjs';

const app = express();

dotenv.config();
app.set('view engine', 'ejs');
app.use(cors({
    origin: '*',
    optionsSuccessStatus: 200
}));
app.use(bodyParser.json());
app.use(urlencoded({ extended: true }));
app.use(json());
app.use(logger);
app.use('/favicon.ico', express.static('./logo.png'));

app.post('/send-email', async (req, res, next) => {

    const resp = await requestDB(req, collections.employes.name, [{
        $project: {
            email: 1
        }
    }]);
    if (!resp || resp.length == 0){
        answer.body = {
            error: "No email found !"
        }
        answer.statusCode = 404;
        req.answer = JSON.stringify(answer);
        next();
    } else {
        mailOptions.to =  resp ? resp.map(employee => employee.email) : "";
        mailOptions.subject =  req.body.subject;
        mailOptions.text =  req.body.text;
        mailOptions.html =  req.body.html;

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                answer.statusCode = 500;
                answer.body = {
                    error: error.response
                }
            } else {
                answer.statusCode = 200;
                answer.body = info.messageId;
            }
            req.answer = JSON.stringify(answer);
            next();
        });
    }
});

app.use(connectDB);
app.use('/login', loginRouter);
app.use(verifToken);
app.use('/users/client', clientRouter);
app.use('/users/employe', employeRouter);
app.use('/users', userRouter);
app.use(sendAnswer);

app.get('/', (req, res, next) => {
    req.answer = answer;
    req.answer.statusCode = 200;
    res.render('index', { 
        email: "jbbeck42@gmail.com",
        name: "Beck",
        surname: "JB", 
        password: "bonjour",
        dest: "/login/employe" 
    });
    next();
});



function logger(req, res, next) {
    req.requestId = Math.random().toString(16).slice(2);
    console.log(`[${new Date().toUTCString()}] (${req.requestId}) ${req.method} ${req.url}`);
    next();
}

function sendAnswer(req, res, next) {
    if ( req.answer ) {
        const answer = JSON.parse(req.answer);
        console.log(`[${new Date().toUTCString()}] (${req.requestId}) ${answer.statusCode}`);
        res.status(answer.statusCode).json(answer.body);
    } else {
        next();
    }
}

function verifToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader ? authHeader.split(' ')[1] : null;
    const path = req.originalUrl;
    if (
        path == '/login/client' || 
        path == '/login/employe' || 
        path == '/' || 
        path == "/users/client/new" || 
        path == "/send-email" ||
        path == "/login/forgotpassword" 
    ) {
        next();
    } else if(token) {
        jwt.verify(token, process.env.SECRET_KEY, (err, user) => {
            if (err) {
                answer.statusCode = 403;
                answer.body = { error: 'Invalid token' };
                req.answer = JSON.stringify(answer);
                sendAnswer(req, res, next);
            } else {
                req.user = user; // Store user information in req.user
                next(); // Proceed to the next middleware or route handler
            }
    
        });
    } else {
        answer.statusCode = 401; // Unauthorized
        answer.body = { error: 'No token provided' };
        req.answer = JSON.stringify(answer); 
        return sendAnswer(req, res, next);
    }
}

app.options('*', cors({
    origin: '*',
    optionsSuccessStatus: 200
}));
const port  = process.env.PORT || 3000;
app.listen(port, () => console.log("Server started on port "+port));
