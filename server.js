const express = require('express')
const app = express()
const port = 3000
const db = require("better-sqlite3")("database.db"); // dùng sqlite3 để tạo database.db
db.pragma("journal_mode = WAL");

// tạo bảng users ở đây
app.createTable = db.transaction(() => {
    db.prepare(
        'CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT, password TEXT)'
    ).run();
});

app.set('view engine', 'ejs');
app.set('views', './views');
app.use(express.urlencoded({ extended: false }));
app.use(express.static("public"));

app.use(function (req, res, next) {
    res.locals.login_errors = [];
    next();
});
app.use(function (req, res, next) {
    res.locals.register_errors = [];
    next();
});
app.get('/', (req, res) => {
    res.render('homepage', { title: 'Trang chủ' })
})

app.get('/login', (req, res) => {
    res.render('login', { title: 'Đăng nhập' })
})

app.post('/login', (req, res) => {
    console.log(req.body);
    const login_errors = [];
    if (typeof req.body.email !== 'string') {
        req.body.email = '';
    }
    if (typeof req.body.password !== 'string') {
        req.body.password = '';
    }
    req.body.email = req.body.email.trim();
    if (req.body.password.length < 6) {
        login_errors.push('Password is too short');
    }
    if (login_errors.length) {
        res.render('login', { title: 'Login Error', login_errors });
        // So we can use the errors message
        return;
    } else {
        res.render('homepage', { title: 'Trang chủ' });
    }
})

app.post('/register', (req, res) => {
    // nên tối ưu vào 1 hàm riêng
    console.log(req.body);
    const register_errors = [];
    if (typeof req.body.email !== 'string') {
        req.body.email = '';
    }
    if (typeof req.body.password !== 'string') {
        req.body.password = '';
    }
    req.body.email = req.body.email.trim();
    if (req.body.password.length < 6) {
        register_errors.push('Password is too short');
    }
    if (req.body.password_confirm != '' && req.body.password != req.body.password_confirm) {
        register_errors.push('Password confirm is not match');
    }
    if (register_errors.length) {
        res.render('signup', { title: 'Register Error', register_errors });
        // So we can use the errors message
        return;
    } else {
        res.render('homepage', { title: 'Trang chủ' });
    }
})

app.get('/signup', (req, res) => {
    res.render('signup', { title: 'Đăng ký' })
})

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}/`)
})
