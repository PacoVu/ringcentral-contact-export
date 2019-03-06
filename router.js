const User = require('./usershandler.js')
require('dotenv').load()
const request = require('request');
var users = []

function getUserIndex(id){
  console.log("USERS LENGTH:" + users.length)
  for (var i=0; i<users.length; i++){
    var user = users[i]
    if (user != null){
      console.log("USER ID:" + user.getUserId())
      if (id == user.getUserId()){
        return i
      }
    }
  }
  return -1
}

function getUserIndexByExtensionId(extId){
  console.log("USERS LENGTH:" + users.length)
  for (var i=0; i<users.length; i++){
    var user = users[i]
    console.log("EXTENSiON ID:" + user.getExtensionId())
    if (extId == user.getExtensionId()){
      return i
    }
  }
  return -1
}

var router = module.exports = {
  loadLogin: function(req, res){
    if (req.query.env == "demo"){
      var user = null
      var index = getUserIndex(100)
      if (index < 0){
        req.session.userId = 100;
        user = new User(100, req.query.env)
        user.setExtensionId(100)
        users.push(user)
      }else{
        user = users[index]
        req.session.userId = 100;
        req.session.extensionId = 100;
      }
      user.loadDemo()
      res.render('readlog', {
        userName: "Demo Guy",
        userLevel: 'demo',
        autoProcessingOn: false
      })
      return
    }
    if (req.session.userId == 0) {
      console.log("load login page")
      var id = new Date().getTime()
      console.log(id)
      req.session.userId = id;
      var user = new User(id, req.query.env)
      users.push(user)
      var p = user.getPlatform()
      if (p != null){
        res.render('login', {
          authorize_uri: p.loginUrl({ // authUrl
            brandId: process.env.RINGCENTRAL_BRAND_ID,
            redirectUri: process.env.RC_APP_REDIRECT_URL
          }),
          redirect_uri: process.env.RC_APP_REDIRECT_URL,
          token_json: ''
        });
      }
    }else{
      console.log("Must be a reload page")
      var index = getUserIndex(req.session.userId)
      if (index >= 0)
        users[index].loadContactsPage(req, res)
      else{
        this.forceLogin(req, res)
      }
    }
  },
  forceLogin: function(req, res){
    console.log("FORCE LOGIN")
    req.session.destroy();
    res.render('index')
    //users[index].forceLogin(req, res)
  },
  login: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    users[index].login(req, res, function(err, extensionId){
      if (!err){
        console.log("USERLENGTH: " + users.length)
        for (var i = 0; i < users.length; i++){
          console.log("REMOVING")
          var extId = users[i].getExtensionId()
          var userId = users[i].getUserId()
          if (extId == extensionId && userId != req.session.userId){
            console.log("REMOVE USER: " )
            users[i] = null
            users.splice(i, 1);
            break
          }
        }
      }
    })
  },
  logout: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0){
      return this.forceLogin(req, res)
    }
    var thisObj = this
    users[index].logout(req, res, function(err, result){
      users[index] = null
      console.log("user length before: " + users.length)
      users.splice(index, 1);
      console.log("user length after: " + users.length)
      thisObj.forceLogin(req, res)
    })

  },
  readExtensionAsync: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    //users[index].readCompanyContactsAsync(req, res)
    //res.send('{"status":"ok", "message":"return nothing"}')
    var thisRes = res
    users[index].readExtensionAsync(req, function(err, data){
      if (!err){
        console.log("SUCCESS")
        console.log(JSON.stringify(data))
        thisRes.send(JSON.stringify(data))
      }
    })
  },
  // use async
  readCompanyContactsAsync: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    //users[index].readCompanyContactsAsync(req, res)
    //res.send('{"status":"ok", "message":"return nothing"}')
    users[index].readCompanyContacts(req, res, function(err, data){
      if (!err){
        console.log("SUCCESS")
        console.log(JSON.stringify({"status":"ok","message":data}))
        //res.send('{"status":"ok", "message":"return nothing"}')
        //res.send(JSON.stringify({"status":"ok","message":data}))
        /*
        res.render('readcontact', {
          userLevel: users[index].getUserLevel(),
          userName: users[index].userName,
          contactList: data
        })
        */
      }
    })
  },
  loadContactsPage: function(req, res){
    var index = getUserIndex(req.session.userId)
    if (index < 0)
      return this.forceLogin(req, res)
    users[index].loadContactsPage(req, res)
  }
}
