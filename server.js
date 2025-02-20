const express = require('express')
const app = express()
const port = 3000

app.set('view engine', 'ejs');
app.use(express.static("public"));

app.get('/', (req, res) => {
    res.render('homepage', { title: 'Trang chủ' })
})

app.get('/login', (req, res) => {
    res.render('login', { title: 'Đăng nhập' })
})

app.get('/signup', (req, res) => {
    res.render('signup', { title: 'Đăng ký' })
})

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}/`)
})
