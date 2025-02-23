require('dotenv').config();
const jwt = require('jsonwebtoken');
const express = require('express')
const bcrypt = require('bcrypt')
const app = express()
const port = 3000
const cookieParser = require('cookie-parser')
const db = require("better-sqlite3")("database.db"); // dùng sqlite3 để tạo database.db
db.pragma("journal_mode = WAL");

function validateInput(email, password, passwordConfirm = null) {
    const errors = [];
    if (typeof email !== 'string') email = '';
    if (typeof password !== 'string') password = '';

    email = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Invalid email format');
    if (password.length < 6) errors.push('Password is too short');
    if (passwordConfirm !== null && password !== passwordConfirm) errors.push('Password confirm does not match');

    return errors;
}

// tạo bảng users ở đây
app.createTable = db.transaction(() => {
    db.prepare(
        'CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT, password TEXT)'
    ).run();
});
app.createTable();

app.set('view engine', 'ejs');
app.set('views', './views');
app.use(express.urlencoded({ extended: false }));
app.use(express.static("public"));
app.use(cookieParser('your_secret_key'));

app.use(function (req, res, next) {
    res.locals.errors = [];

    try {
        const token = req.signedCookies.token;
        if (token) {
            const decoded = jwt.verify(token, process.env.JWTSECRET);
            req.user = decoded;
        }
    } catch (error) {
        console.error('JWT error:', error);
    }
    res.locals.user = req.user;
    next();
});


app.post('/logout', (req, res) => {
    res.clearCookie('token');
    res.redirect('/');
}) // vẫn chưa hoàn thiện

app.get('/users', (req, res) => {
    const users = db.prepare('SELECT * FROM users').all();
    res.json(users);
})

app.get('/', (req, res) => {
    res.render('homepage', { title: 'Trang chủ' })
})

app.get('/login', (req, res) => {
    res.render('login', { title: 'Đăng nhập' })
})

app.get('/signup', (req, res) => {
    res.render('signup', { title: 'Đăng ký' })
})

app.post('/register', async (req, res) => {
    const { email, password, password_confirm } = req.body;
    res.locals.errors = validateInput(email, password, password_confirm);

    if (res.locals.errors.length) {
        return res.render('signup', { title: 'Register Error', errors: res.locals.errors });
    }

    try {
        const existingUser = db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim());
        if (existingUser) {
            return res.render('signup', { title: 'Register Error', errors: ['Email already exists'] });
        }

        const salt = bcrypt.genSaltSync(10);
        const hashedPassword = bcrypt.hashSync(password, salt);
        const mySignupState = db.prepare('INSERT INTO users(email, password) VALUES(?, ?)');
        mySignupState.run(email.trim(), hashedPassword);
        res.redirect('/');
    } catch (error) {
        console.error('Database error:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    res.locals.errors = validateInput(email, password);

    if (res.locals.errors.length) {
        return res.render('login', { title: 'Login Error', errors: res.locals.errors });
    }

    try {
        const userStatement = db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim());

        if (!userStatement) {
            return res.render('login', { title: 'Login Error', errors: ['Email or password is incorrect'] });
        }

        if (!bcrypt.compareSync(password, userStatement.password)) {
            return res.render('login', { title: 'Login Error', errors: ['Email or password is incorrect'] });
        }
        const TokenValue = jwt.sign({ exp: Math.floor(Date.now() / 1000 + 60 * 60 * 24), skycolor: "blue", user_id: userStatement.id, username: userStatement.email }, process.env.JWTSECRET);

        res.cookie('token', TokenValue, {
            maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
            httpOnly: true,
            signed: true,
            sameSite: 'strict'
        });
        res.redirect('/');
    } catch (error) {
        console.error('Database error:', error);
        res.status(500).send('Internal Server Error');
    }
});




app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}/`)
})
