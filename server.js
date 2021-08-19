const express = require('express');
const productos = require('./api/productos');
const Mensajes = require('./api/mensajes')
const handlebars = require('express-handlebars')
const app = express();
const http = require('http');
const server = http.Server(app);
const io = require('socket.io')(server);
const Faker = require('./models/faker');
const normalize = require('normalizr').normalize;
const schema = require('normalizr').schema;
const session = require('express-session');
const cookieParser = require('cookie-parser')
const passport = require('passport');
const bCrypt = require('bCrypt');
const FacebookStrategy = require('passport-facebook').Strategy;
const User = require('./models/users')
const dotenv = require('dotenv');
dotenv.config();
const { fork } = require('child_process');
const numCPUs = require('os').cpus().length
//CONECTAR CON MONGOOSE A LA DB DE MONGO
require('./database/connection');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: 'secreto',
    resave: false,
    saveUninitialized: false
}));
// ---------------------------------------------------------------------------------------------

// PASSPORT

// setear facebook client id y secret key por linea de comando
let FACEBOOK_CLIENT_ID = " "
let FACEBOOK_CLIENT_SECRET = " ";

if (process.argv[3] && process.argv[4]) {
    FACEBOOK_CLIENT_ID = process.argv[3];
    FACEBOOK_CLIENT_SECRET = process.argv[4];
} else {
    console.log('No se ingresaron los valores correctamente. Se procede a usar valores por defecto')
    FACEBOOK_CLIENT_ID = process.env.FACEBOOK_CLIENT_ID;
    FACEBOOK_CLIENT_SECRET = process.env.FACEBOOK_CLIENT_SECRET;
}

passport.use(new FacebookStrategy({
    clientID: FACEBOOK_CLIENT_ID,
    clientSecret: FACEBOOK_CLIENT_SECRET,
    callbackURL: '/auth/facebook/callback',
    profileFields: ['id', 'displayName', 'photos', 'emails'],
    scope: ['email']
}, function (accessToken, refreshToken, profile, done) {
    let userProfile = profile._json;
    console.log(userProfile);
    return done(null, userProfile);
}));

passport.serializeUser(function (user, done) {

    done(null, user);
});

passport.deserializeUser(function (user, done) {

    done(null, user);
});


app.use(passport.initialize());
app.use(passport.session());

// ---------------------------------------------------------------------------------------------

// ---------------------------------------------------------------------------------------------
// ARCHIVOS ESTÁTICOS
app.use(express.static('public'));

//CONFIGURAR HANDLEBARS
app.engine('hbs', handlebars({
    extname: '.hbs',
    defaultLayout: 'index.hbs',
    layoutsDir: __dirname + '/views/layouts'
}));

// ESTABLECER MOTOR DE PLANTILLAS
app.set("view engine", "hbs");
// DIRECTORIO ARCHIVOS PLANTILLAS
app.set("views", "./views");

// CREAR ROUTER
const routerProductos = express.Router();
const routerMensajes = express.Router();

// USAR ROUTERS
app.use('/api/productos', routerProductos);
app.use('/api/mensajes', routerMensajes);


// ---------------------------------------------------------------------------------------------


// LOGIN CON FACEBOOK

app.get('/auth/facebook', passport.authenticate('facebook'));

app.get('/auth/facebook/callback', passport.authenticate('facebook',
    {
        successRedirect: '/login',
        failureRedirect: '/faillogin'
    }
));

app.get('/login', (req, res) => {

    res.render('vista', {
        showLogin: false,
        showContent: true,
        bienvenida: req.user.name,
        email: req.user.email,
        urlImg: req.user.picture.data.url,
        showBienvenida: true
    });
})

app.get('/faillogin', (req, res) => {
    res.sendFile(__dirname + '/public/failLogin.html')
})

// LOGOUT
app.get('/logout', (req, res) => {
    req.logout();
    res.sendFile(__dirname + '/public/logout.html')
})


///////////////////// RUTA INFO /////////////////////

app.get('/info', (req, res) => {
    let informacion = {}
    informacion['Argumentos de entrada:'] = `${process.argv[2]} ${process.argv[3]} ${process.argv[4]}`;
    informacion['Nombre de plataforma:'] = process.platform;
    informacion['Version de Node:'] = process.version;
    informacion['Uso de memoria:'] = process.memoryUsage();
    informacion['Path de ejecucion:'] = process.execPath;
    informacion['Process id:'] = process.pid;
    informacion['Carpeta corriente:'] = process.cwd();
    informacion['Numero de procesadores'] = numCPUs

    res.send(JSON.stringify(informacion, null, 4))
})
//////////////////// NUMERO RANDOM ////////////////////

app.get('/random', (req, res) => {
    const numeroRandom = fork('./api/numeroRandom.js')
    let cantidad = 0
    if (req.query.cant) {
        cantidad = req.query.cant
    } else {
        cantidad = 100000000
    }
    numeroRandom.send((cantidad).toString());
    numeroRandom.on("message", obj => {
        res.end(JSON.stringify(obj, null, 3));
    });
})


//////////////////// MENSAJES ///////////////////////

// LISTAR TODOS LOS MENSAJES
routerMensajes.get('/leer', async (req, res) => {
    try {
        let result = await Mensajes.devolver();
        return res.json(result);
    } catch (error) {
        return res.status(500).send({ error: error.message });
    }
});

// LISTAR MENSAJES POR ID
routerMensajes.get('/leer/:id', async (req, res) => {
    try {
        let result = await Mensajes.buscarPorId(req.params.id);
        return res.json(result);
    } catch (error) {
        return res.status(500).send({ error: error.message });
    }
});

// GUARDAR MENSAJES EN DB
routerMensajes.post('/guardar', async (req, res) => {
    try {
        let result = await Mensajes.guardar(req.body);
        return res.json(result);
    } catch (error) {
        return res.status(500).send({ error: error.message });
    }
});

// ACTUALIZAR UN MENSAJE
routerMensajes.put('/actualizar/:id', async (req, res) => {
    try {
        let result = await Mensajes.actualizar(req.params.id, req.body);
        return res.json(result);
    } catch (error) {
        return res.status(500).send({ error: error.message });
    }
});

// BORRAR UN MENSAJE
routerMensajes.delete('/borrar/:id', async (req, res) => {
    try {
        let result = await Mensajes.borrar(req.params.id);
        return res.json(result);
    } catch (error) {
        return res.status(500).send({ error: error.message });
    }
});

// VISTA-TEST ** FAKER **
routerProductos.get('/vista-test/', (req, res) => {
    res.render('vista', { hayProductos: true, productos: Faker.generarProductos(10) })
})

routerProductos.get('/vista-test/:cant', (req, res) => {
    let cantidad = req.params.cant
    res.render('vista', { hayProductos: true, productos: Faker.generarProductos(cantidad) })
})

// LISTAR PRODUCTOS
routerProductos.get('/listar', async (req, res) => {
    try {
        let result = await productos.listar();
        return res.json(result);
    } catch (error) {
        return res.status(500).send({ error: error.message });
    }
})

// LISTAR PRODUCTOS POR ID
routerProductos.get('/listar/:id', async (req, res) => {

    try {
        let mensajeLista = await productos.listarPorId(req.params.id);
        res.json(mensajeLista)
    } catch (error) {
        return res.status(500).send({ error: error.message });
    }
})


// GUARDAR PRODUCTO
routerProductos.post('/guardar', async (req, res) => {
    try {
        let nuevoProducto = {};
        nuevoProducto.title = req.body.title;
        nuevoProducto.price = req.body.price;
        nuevoProducto.thumbnail = req.body.thumbnail;
        await productos.guardar(nuevoProducto)
        res.json(nuevoProducto)
    } catch (error) {
        return res.status(500).send({ error: error.message });
    }
})

//ACTUALIZAR PRODUCTO POR ID
routerProductos.put('/actualizar/:id', async (req, res) => {
    try {
        let nuevoProducto = await productos.actualizar(req.params.id, req.body);
        res.json(nuevoProducto);
    } catch (error) {
        return res.status(500).send({ error: error.message });
    }
})

// BORRAR PRODUCTO POR ID
routerProductos.delete('/borrar/:id', async (req, res) => {
    let productoBorrado = await productos.borrar(req.params.id);
    return res.json(productoBorrado);
})

// DATOS CHAT
const messages = [
    {
        autor: {
            email: "juan@gmail.com",
            nombre: "Juan",
            apellido: "Perez",
            edad: 25,
            alias: "Juano",
            avatar: "http://fotos.com/avatar.jpg"
        },
        texto: '¡Hola! ¿Que tal?'
    }
];

// SE EJECUTA AL REALIZAR LA PRIMERA CONEXION
io.on('connection', async socket => {
    console.log('Usuario conectado')

    // GUARDAR PRODUCTO
    socket.on('nuevo-producto', nuevoProducto => {
        console.log(nuevoProducto)
        productos.guardar(nuevoProducto)
    })
    // VERIFICAR QUE SE AGREGA UN PRODUCTO
    socket.emit('guardar-productos', () => {
        socket.on('notificacion', data => {
            console.log(data)
        })
    })
    // ACTUALIZAR TABLA
    socket.emit('actualizar-tabla', await productos.listar())

    // GUARDAR Y MANDAR MENSAJES QUE LLEGUEN DEL CLIENTE
    socket.on("new-message", async function (data) {


        await Mensajes.guardar(data)

        let mensajesDB = await Mensajes.getAll()

        const autorSchema = new schema.Entity('autor', {}, { idAttribute: 'nombre' });

        const mensajeSchema = new schema.Entity('texto', {
            autor: autorSchema
        }, { idAttribute: '_id' })

        const mensajesSchema = new schema.Entity('mensajes', {
            msjs: [mensajeSchema]
        }, { idAttribute: 'id' })

        const mensajesNormalizados = normalize(mensajesDB, mensajesSchema)

        messages.push(mensajesDB);

        console.log(mensajesDB)

        console.log(mensajesNormalizados)

        io.sockets.emit("messages", mensajesNormalizados);
    });
});

// pongo a escuchar el servidor en el puerto indicado
// definir puerto por linea de comandos
let puerto = 0
if (process.argv[2] && !isNaN(process.argv[2])) {
    puerto = process.argv[2]
} else if (isNaN(process.argv[2])) {
    console.log('No se ingresó un puerto válido, se usará el 8080')
    puerto = 8080
}


// USO server PARA EL LISTEN
const svr = server.listen(puerto, () => {
    console.log(process.argv)
    console.log(`servidor escuchando en http://localhost:${puerto}`);
});


// en caso de error, avisar
server.on('error', error => {
    console.log('error en el servidor:', error);
});
