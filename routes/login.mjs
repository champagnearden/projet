import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { answer } from '../models/answer.mjs'
import { collections, deleteDB, insertDB, requestDB, updateDB } from '../models/bdd.mjs';
import { transporter, mailOptions } from '../models/email.mjs';

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

router.post('/forgotpassword', async (req, res, next) => {
    const { otp, username, password, type } = req.body;
    query = [
        {
            $project: {
                email: 1,
                _id: 1
            }
        }
    ];
    if (type) {
        if (type === "clients") {
            query.unshift({
                $match: {
                    email: username
                }
            });
        } else {
            query.unshift({
                $match: {
                    username
                }
            });
        }        
    }
    const clients = await requestDB(req, type, query);
    if (clients.length != 0){
        if (otp) {
            // got the otp code
            const otpVerif = await requestDB(req, collections.otp.name, [
                {
                    $match: { otp, username }
                },
                {
                    $project: {
                        _id: 1,
                        username: 1
                    }
                }
            ]);
            if (otpVerif) {
                const modifPassword = await updateDB(req, type, {
                    _id: clients[0]._id,
                    body: {
                        password: await bcrypt.hash(password, saltRounds)
                    }
                });
                if (modifPassword?.modifiedCount == 1) {
                    await deleteDB(req, collections.otp.name, otpVerif[0]._id);
                    answer.statusCode = 200;
                    answer.body = modifPassword
                } else {
                    answer.statusCode = 500;
                    answer.statusCode = {
                        error: "Unable to change the password"
                    }
                }
            }            
        } else if (!password) {
            //send-email with a new token
            const otp = generateOTP();
            mailOptions.to = clients[0].email;
            mailOptions.subject = "Réinitialisation de mot de passe";
            mailOptions.html =  `<body style="font-family: Arial, sans-serif; width: 100%; margin: auto 0; padding:0;"><div id="email" style="margin: auto; width: 600px; background-color: white;"><table width="100%"><tr><td bgcolor="#FF7900" align="center" style="color: white;"><h1>Réinitialisation de mot de passe</h1></td></tr></table><table bgcolor="#EAF0F6" width="100%" style="margin-top: 5px; font-size: 25px;" ><tr><td style="padding: 100px 10px;"><p style="font-weight: bold" align="center">${otp}</p><p>Entrez ce code dans la page de votre navigateur.</p></td></tr></table><table width="100%"><tr><td style="font-size: 10px;" ><p>&copy; 2024 Banque Virtuella. Tous droits réservés.</p></td></tr></table></div></body>`;
            try {
                const mailAnswer = await transporter.sendMail(mailOptions);
                if (mailAnswer) {
                    const otpClient = await requestDB(req, collections.otp.name, [
                        {
                            $match: { 
                                username: req.body.username
                            }
                        },
                        {
                            $project: {
                                otp: 1,
                                _id: 1
                            }
                        }
                    ]);
                    let resultOtp;
                    if (otpClient.length != 0) {
                        resultOtp = await updateDB(req, collections.otp.name, {
                            _id: otpClient[0]._id,
                            body: {
                                otp
                            }
                        });
                    } else {
                        resultOtp = await insertDB(req, collections.otp.name, {
                            otp,
                            username: req.body.username,
                            type: req.body.type
                        });
                    }
                    if (resultOtp) {
                        answer.statusCode = 200;
                        answer.body = {
                            message: "Email sent"
                        }
                    } else {
                        answer.statusCode = 500;
                        answer.body = {
                            error: "Unabled to create OTP"
                        }
                    }
                } else {
                    answer.statusCode = 500;
                    answer.body = {
                        error: "Unabled to send Email"
                    }
                }
            } catch (error) {
                answer.statusCode = 500;
                answer.body = {
                    error: error.message
                }
            }
        }
    } else {
        answer.statusCode = 404;
        answer.body = {
            error: "Unkown user"
        }
    }
    req.answer = JSON.stringify(answer);
    next();
});

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

function generateOTP() { 
  
    // Declare a digits variable 
    // which stores all digits  
    let digits = '0123456789'; 
    let OTP = ''; 
    let len = digits.length 
    for (let i = 0; i < 4; i++) { 
        OTP += digits[Math.floor(Math.random() * len)]; 
    } 
     
    return OTP; 
} 

export default router;