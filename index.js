var path = require('path')
var util = require('util')

if('production' !== process.env.LOCAL_ENV )
  require('dotenv').load();

var express = require('express');
var session = require('express-session');

var app = express();
//app.use(session());
app.use(session({ secret: 'this-is-a-secret-token', cookie: { maxAge: 24 * 60 * 60 * 1000 }}));
var bodyParser = require('body-parser');
var urlencoded = bodyParser.urlencoded({extended: false})

app.use(express.static(path.join(__dirname, 'public')))
app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'ejs')
app.use(urlencoded);

var port = process.env.PORT || 5000

var server = require('http').createServer(app);
server.listen(port);
console.log("listen to port " + port)
var router = require('./router');

app.get('/', function (req, res) {
  console.log('load option page /')
  res.render('index')
})
app.get('/login', function (req, res) {
  console.log('login to /')
  req.session.cookie = { maxAge: 24 * 60 * 60 * 1000 }
  if (!req.session.hasOwnProperty("userId"))
    req.session.userId = 0;
    if (!req.session.hasOwnProperty("extensionId"))
      req.session.extensionId = 0;
  console.log("SESSION:" + JSON.stringify(req.session))
  router.loadLogin(req, res)
})

app.get('/index', function (req, res) {
  console.log('load option page /')
  if (req.query.n != undefined && req.query.n == 1){
    console.log('logout from here?')
    router.logout(req, res)
  }else {
    res.render('index')
  }
})

app.get('/logout', function (req, res) {
  console.log('logout why here?')
  router.logout(req, res)
})

app.get('/readcontact', function (req, res) {
  console.log('loadReadContactPage')
  router.loadReadContactPage(req, res)
})

app.get('/exportcontact', function (req, res) {
  console.log('loadExportContactPage')
  router.loadExportContactPage(req, res)
})

app.get('/oauth2callback', function(req, res){
  console.log("callback redirected")
  router.login(req, res)
})

app.post('/readcompanycontacts', function (req, res) {
  console.log("readCompanyContactsAsync")
  if (!req.session.hasOwnProperty("configs")){
    if (req.body.accessKeyId == "" ||
        req.body.secretAccessKey == "" ||
        req.body.region == ""){
      console.log("missing credentials")
      return res.send('{"status":"failed","message":"Please provide AWS credentials."}')
    }else{
      req.session.configs = req.body
    }
  }
  router.readCompanyContactsAsync(req, res)
})

app.post('/exportcontacts', function (req, res) {
  console.log('exportcontacts')
  router.exportContactsAsync(req, res)
})

app.get('/about', function (req, res) {
  //res.render('about')
  router.loadAboutPage(req, res)
})

app.post('/readcontacts', function (req, res) {
  console.log("readCallRecordingsAsync")
  if (!req.session.hasOwnProperty("configs")){
    if (req.body.accessKeyId == "" ||
        req.body.secretAccessKey == "" ||
        req.body.region == "")
      return res.send('{"status":"failed","message":"Please provide AWS credentials."}')
    else
      req.session.configs = req.body
  }
  router.readCompanyContactsAsync(req, res)
})
