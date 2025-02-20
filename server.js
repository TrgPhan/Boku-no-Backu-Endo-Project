const express = require('express')
const app = express()
const port = 3000

app.set('view engine', 'ejs');
app.set('views', './views');
app.use(express.urlencoded({ extended: false }));
app.use(express.static("public"));

app.get('/', (req, res) => {
    res.render('homepage', { title: 'Trang chủ' })
})

app.get('/login', (req, res) => {
    res.render('login', { title: 'Đăng nhập' })
})

app.post('/register', (req, res) => {
    const errors = [];
    if (typeof req.body.email !== 'string') {
        req.body.email = '';
    }
    if (typeof req.body.password !== 'string') {
        req.body.password = '';
    }
    req.body.email = req.body.email.trim();
    req.body.password = req.body.password.trim();
    if (!req.body.email) {
        errors.push('Email should not be empty');
    }
    if (!req.body.password) {
        errors.push('Password should not be empty');
    }
    if (req.body.email && !req.body.email.includes('@')) {
        errors.push('Email should have @ character');
    }
    if (req.body.email && !req.body.email.match(/^[a-zA-Z0-9]+$/)) {
        errors.push('Email should have character');
    }
    if (errors.length) {
        res.render('homepage', { title: 'Trang chủ', errors });
        // So we can use the errors message
        return;
    } else {
        res.send('Thank you for registering');
    }
})

app.get('/signup', (req, res) => {
    res.render('signup', { title: 'Đăng ký' })
})

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}/`)
})
