import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    port: 465,               // true for 465, false for other ports
    host: "smtp.gmail.com",
        auth: {
            user: process.env.EMAIL,
            pass: process.env.EMAIL_PASSWORD,
        },
    secure: true
});

const mailOptions = {
    from: `"Virtuella" <${process.env.EMAIL}>`,
    to: "",
    subject: "",
    text: "",
    html: ""
};

export { transporter, mailOptions };