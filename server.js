require('dotenv').config();
const jwt = require('jsonwebtoken');
const express = require('express')
const sanitizeHTML = require('sanitize-html')
const bcrypt = require('bcrypt')
const app = express()
const port = 3000
const cookieParser = require('cookie-parser')
const db = require("better-sqlite3")("database.db"); // dùng sqlite3 để tạo database.db
db.pragma("journal_mode = WAL");

function ValidateSharedPost(req) {
    const errors = [];

    if (typeof req.body.title !== 'string') {
        req.body.title = '';
    }

    if (typeof req.body.content !== 'string') {
        req.body.content = '';
    }

    req.body.title = sanitizeHTML(req.body.title.trim(), { allowedTags: [], allowedAttributes: {} });
    req.body.content = sanitizeHTML(req.body.content.trim(), { allowedTags: [], allowedAttributes: {} });

    if (!req.body.title) {
        errors.push('Tiêu đề không được để trống');
    }

    if (!req.body.content) {
        errors.push('Nội dung không được để trống');
    }


    return errors;
}

function mustBeLoggedIn(req, res, next) {
    if (req.user) {
        return next();
    }
    return res.redirect("/");
}

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
        `CREATE TABLE IF NOT EXISTS users(
            id INTEGER PRIMARY KEY AUTOINCREMENT, 
            email TEXT UNIQUE, 
            password TEXT,
            fullname TEXT DEFAULT ' ',
	        phone TEXT DEFAULT ' ',
	        address TEXT DEFAULT ' ',
	        bio TEXT DEFAULT 'Chưa có giới thiệu',
	        skills TEXT DEFAULT '[]',
	        education TEXT DEFAULT '{"degree": "", "university": "", "duration": ""}',
	        experience TEXT DEFAULT '[{"position":"","company":"","duration":"","responsibilities":[""]}]'
        )`
    ).run()

    db.prepare(
        `CREATE TABLE IF NOT EXISTS posts(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            author_id INTEGER,
            title TEXT,
            content TEXT,
            createdDate TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(author_id) REFERENCES users(id)
        )`
    ).run()
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


app.get('/profile', (req, res) => {
    if (!req.user) return res.redirect('/login');

    const user = db.prepare(`
        SELECT 
            id,
            email,
            fullname,
            phone,
            address,
            bio,
            skills,
            education,
            experience
        FROM users 
        WHERE id = ?
    `).get(req.user.user_id);

    // Xử lý dữ liệu mặc định
    const profileData = user ? {
        ...user,
        bio: user.bio || 'Chưa có giới thiệu',
        skills: user.skills || '[]',
        education: user.education || '{}',
        experience: user.experience || '[]'
    } : {};

    res.render('profile', {
        title: 'Hồ sơ cá nhân',
        user: profileData
    });
});

app.get('/logout', (req, res) => {
    res.clearCookie('token');
    res.redirect('/');
})

app.get('/users', (req, res) => {
    const users = db.prepare('SELECT * FROM users').all();
    res.json(users);
})

app.get('/', (req, res) => {
    if (req.user) {
        const postsStatement = db.prepare('SELECT * FROM posts WHERE author_id = ? ORDER BY createdDate DESC');
        const posts = postsStatement.all(req.user.user_id);
        return res.render('dashboard', { posts });
    }
    res.render('homepage', { title: 'Trang chủ' })
})

app.get('/login', (req, res) => {
    res.render('login', { title: 'Đăng nhập' })
})

app.get('/signup', (req, res) => {
    res.render('signup', { title: 'Đăng ký' })
})

// Hiển thị form chỉnh sửa
app.get('/profile/edit', (req, res) => {
    if (!req.user) return res.redirect('/login');

    const user = db.prepare(`
        SELECT id, fullname, phone, address, bio, skills, education, experience 
        FROM users WHERE id = ?
    `).get(req.user.user_id);

    res.render('edit_profile', {
        title: 'Chỉnh sửa hồ sơ',
        user: user || {}
    });
})

app.get('/create-post', mustBeLoggedIn, (req, res) => {
    res.render('create_post', { title: 'Tạo bài viết' })
})

app.get('/edit-post/:id', mustBeLoggedIn, (req, res) => {
    const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
    if (post.author_id != req.user.user_id) return res.status(404).send('Not found').redirect('/');
    if (!post) return res.status(404).send('Not found').redirect('/');

    res.render('edit-post', {
        title: 'Chỉnh sửa bài viết',
        post
    });
})

app.get('/post/:id', (req, res) => {
    const post = db.prepare('SELECT p.*, u.email FROM posts p INNER JOIN users u ON p.author_id = u.id WHERE p.id = ?').get(req.params.id);
    if (!post) return res.status(404).send('Not found').redirect('/');

    const isAuthor = post.author_id == req.user.user_id;

    res.render('single-post', {
        title: post.title,
        post,
        isAuthor
    });
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


app.post('/profile/update', (req, res) => {
    if (!req.user) return res.redirect('/login');

    const { fullname, phone, address, bio, skills, education, experience } = req.body;
    const errors = [];

    // Validate dữ liệu
    if (!fullname || fullname.trim().length < 2) errors.push('Tên phải có ít nhất 2 ký tự');
    if (phone && !/^[0-9+\- ]+$/.test(phone)) errors.push('Số điện thoại không hợp lệ');

    if (errors.length > 0) {
        return res.render('edit_profile', {
            title: 'Lỗi cập nhật',
            user: req.body,
            errors
        });
    }

    try {
        // Chuyển đổi dữ liệu JSON
        const skillsArray = JSON.parse(skills || '[]');
        const educationObj = JSON.parse(education || '{}');
        const experienceArray = JSON.parse(experience || '[]');

        db.prepare(`
            UPDATE users SET
                fullname = ?,
                phone = ?,
                address = ?,
                bio = ?,
                skills = ?,
                education = ?,
                experience = ?
            WHERE id = ?
        `).run(
            fullname.trim(),
            phone.trim(),
            address.trim(),
            bio.trim(),
            JSON.stringify(skillsArray),
            JSON.stringify(educationObj),
            JSON.stringify(experienceArray),
            req.user.user_id
        );

        res.redirect('/profile');
    } catch (e) {
        console.error('Update error:', e);
        res.render('edit_profile', {
            title: 'Lỗi cập nhật',
            user: req.body,
            errors: ['Dữ liệu không hợp lệ, vui lòng kiểm tra lại']
        });
    }
})

app.post('/edit-post/:id', mustBeLoggedIn, (req, res) => {
    const { title, content } = req.body;
    const errors = ValidateSharedPost(req);
    if (errors.length) {
        return res.render('edit-post', {
            title: 'Lỗi chỉnh sửa bài viết',
            errors
        });
    }

    const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
    if (!post) return res.status(404).send('Not found').redirect('/');

    if (post.author_id != req.user.user_id) return res.status(403).send('Forbidden').redirect('/');

    const updatePostStatement = db.prepare('UPDATE posts SET title = ?, content = ? WHERE id = ?');
    updatePostStatement.run(title, content, req.params.id);

    res.redirect(`/post/${req.params.id}`);
})

app.post('/create-post', mustBeLoggedIn, (req, res) => {
    const { title, content } = req.body;
    const errors = ValidateSharedPost(req);
    if (errors.length) {
        return res.render('create_post', {
            title: 'Lỗi tạo bài viết',
            errors
        });
    }

    const postStatement = db.prepare('INSERT INTO posts(author_id, title, content, createdDate) VALUES(?, ?, ?, ?)');
    const result = postStatement.run(req.user.user_id, title, content, new Date().toISOString());

    const getPostStatement = db.prepare('SELECT * FROM posts WHERE ROWID = ?');
    const newPost = getPostStatement.get(result.lastInsertRowid);
    res.redirect(`/post/${newPost.id}`);
})

app.post('/delete-post/:id', mustBeLoggedIn, (req, res) => {
    const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
    if (!post) return res.status(404).send('Not found').redirect('/');

    if (post.author_id != req.user.user_id) return res.status(403).send('Forbidden').redirect('/');

    db.prepare('DELETE FROM posts WHERE id = ?').run(req.params.id);
    res.redirect('/');
})

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}/`)
})

