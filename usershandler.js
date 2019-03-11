var RC = require('ringcentral')
var fs = require('fs')
var async = require("async");
const RCPlatform = require('./platform.js')
require('dotenv').load()

function User(id, mode) {
  this.id = id;
  this.admin = false;
  this.extensionId = "";
  this.extIndex = 0
  this.token_json = {};
  this.userName = ""

  this.contactList = []
  this.mainCompanyPhoneNumber = ""
  this.ASK = require('aws-sdk');
  this.rc_platform = new RCPlatform(this, mode)
  return this
}

User.prototype = {
    setExtensionId: function(id) {
      this.extensionId = id
    },
    setAdmin: function() {
      this.admin = true
    },
    setUserToken: function (token_json){
      this.token_json = token_json
    },
    setUserName: function (userName){
      this.userName = userName
    },
    getUserId: function(){
      return this.id
    },
    isAdmin: function(){
      return this.admin
    },
    getExtensionId: function(){
      return this.extensionId
    },
    getUserToken: function () {
      return this.token_json;
    },
    getUserName: function(){
      return this.userName;
    },
    getPlatform: function(){
      return this.rc_platform.getPlatform()
    },
    getUserLevel: function(){
      var userLevel = ''
        if (this.isAdmin())
          userLevel = 'admin'
        else
        userLevel = 'standard'
      return userLevel
    },
    loadReadContactPage: function(req, res){
      res.render('readcontact', {
          userLevel: this.getUserLevel(),
          userName: this.getUserName(),
          contactList: this.contactList
        })
    },
    loadExportContactPage: function(req, res){
      res.render('exportcontact', {
          userLevel: this.getUserLevel(),
          userName: this.getUserName(),
          contactList: this.contactList
      })
    },
    login: function(req, res, callback){
      var thisReq = req
      if (req.query.code) {
        console.log("CALL LOGIN FROM USER")
        var rc_platform = this.rc_platform
        var thisUser = this
        rc_platform.login(req.query.code, function (err, extensionId){
          if (!err){
            thisUser.setExtensionId(extensionId)
            req.session.extensionId = extensionId;
            callback(null, extensionId)
            var thisRes = res
            var p = thisUser.getPlatform()
            p.get('/account/~/extension/~/')
              .then(function(response) {
                var jsonObj = response.json();
                thisUser.rc_platform.setAccountId(jsonObj.account.id)
                thisRes.send('login success');
                if (jsonObj.permissions.admin.enabled){
                  thisUser.setAdmin(true)
                }
                var fullName = jsonObj.contact.firstName + " " + jsonObj.contact.lastName
                thisUser.setUserName(fullName)
              })
              .catch(function(e) {
                console.log("Failed")
                console.error(e);
                callback("error", e.message)
              });
          }else {
            console.log("USER HANDLER ERROR: " + thisUser.extensionId)
            callback("error", thisUser.extensionId)
          }
        })
      } else {
        res.send('No Auth code');
        callback("error", null)
      }
    },
    exportCompanyContactsAsync: function(req, res){
      // write aws credentials to temp file
      console.log("configs: " + JSON.stringify(req.session.configs))
      var thisUser = this
      //var ASK = require('aws-sdk');
      var fileName = "aws/" + this.getExtensionId()  + "_configs.json"
      fs.writeFile(fileName, JSON.stringify(req.session.configs), function(err) {
          if(err) {
              console.log(err);
              return res.send('{"status":"failed","message":"Cannot write configs file."}')
          }
          console.log("load AWS configs");
          thisUser.ASK.config.loadFromPath("./"+fileName);
          fs.unlinkSync(fileName); // delete file immediately
          var a4b = new thisUser.ASK.AlexaForBusiness();
          var contacts = JSON.parse(req.body.contacts)
          async.each(contacts,
            function(params, callback){
                a4b.createContact(params, function(err, data) {
                  if (err){
                    return callback(null, null)
                  }else{
                    console.log(data);           // successful response
                    return callback(null, data)
                  }
                });
            },
            function (err){
              console.log("DONE EXPORT")
              setTimeout(function(){
                console.log("Update list")
                thisUser.readCompanyContactsSync(req, res)
              }, 1000)
            })
      })
    },
    readCompanyContactsSync: function(req, res){
        console.log("readCompanyContactsSync")
        var fileName = "aws/" + this.getExtensionId()  + "_configs.json"
        var thisUser = this
        fs.writeFile(fileName, JSON.stringify(req.session.configs), function(err) {
            if(err) {
                console.log(err);
                return res.send('{"status":"failed","message":"Cannot write configs file."}')
            }
            console.log("load AWS configs");
            thisUser.ASK.config.loadFromPath("./"+fileName);
            fs.unlinkSync(fileName);
            var a4b = new thisUser.ASK.AlexaForBusiness();
            console.log("search AWS contacts");
            var p = thisUser.rc_platform.getPlatform()
            a4b.searchContacts({}, function(err, data) {
                if (err){
                  console.log("Invalid credentials");
                  return res.send({"status":"failed","message":"Invalid AWS credentials"})
                }else{
                    console.log(data);
                    var params = {
                      'type': "User",
                      'perPage': "all"
                    }
                    p.get('/restapi/v1.0/account/~/directory/entries', params)
                      .then(function(resp){
                        var json = resp.json()
                        thisUser.contactList = [];
                        var countId = 0
                        for (var record of json.records){
                          console.log(JSON.stringify(record))
                          console.log("------")
                          if (record.hasOwnProperty("phoneNumbers")) {
                            if (record.hasOwnProperty("lastName") || record.hasOwnProperty("firstName")) {
                              var lineId = 0
                              for (var i=0; i < record.phoneNumbers.length; i++)  {
                                if (record.phoneNumbers[i].usageType == "DirectNumber") {
                                  var phoneNumber = record.phoneNumbers[i].phoneNumber
                                  var lName = (record.hasOwnProperty("lastName")) ? record.lastName : ""
                                  var fName = (record.hasOwnProperty("firstName")) ? record.firstName : ""
                                  var displayName = lName + " " + fName
                                  displayName = displayName.trim()
                                  var params = {}
                                  params['FirstName'] = fName
                                  params['LastName'] = lName
                                  params['DisplayName'] = (lineId == 0) ? displayName : (displayName + " - line " + lineId)
                                  params['PhoneNumber'] = phoneNumber
                                  params['Selected'] = false
                                  params['Id'] = countId
                                  countId++
                                  var numberExisted = false
                                  for (var contact of data['Contacts']){
                                      if (contact['PhoneNumber'] == phoneNumber){
                                      //if (contact['DisplayName'] == displayName){
                                        console.log("number existed: " + contact['PhoneNumber'] + "/" + phoneNumber)
                                        numberExisted = true
                                        break;
                                      }
                                  }
                                  params['ExistInAWS'] = numberExisted
                                  if (i == record.phoneNumbers.length - 1)
                                    params['AddDivider'] = true
                                  else
                                    params['AddDivider'] = false
                                  thisUser.contactList.push(params);
                                  lineId++
                                }
                              }
                            }else{
                              console.log("contact has no name at all")
                            }
                          }else{
                            console.log("contact has no phoneNumbers at all")
                          }
                        }
                        res.send('{"status":"ok","message":'+ JSON.stringify(thisUser.contactList) +'}')
                      })
                      .catch(function(e){
                        console.log("Read company contact failed")
                        res.send('{"status":"failed","message":'+ JSON.stringify(e) +'}')
                      })
                }
            });
          }); // close writeFile
    },
    readCompanyContactsAsync: function(req, res){
        console.log("readCompanyContactsAsync")
        var fileName = "aws/" + this.getExtensionId()  + "_configs.json"
        var thisUser = this
        fs.writeFile(fileName, JSON.stringify(req.session.configs), function(err) {
            if(err) {
                console.log(err);
                return res.send('{"status":"failed","message":"Cannot write configs file."}')
            }
            console.log("load AWS configs");
            thisUser.ASK.config.loadFromPath("./"+fileName);
            fs.unlinkSync(fileName);
            var a4b = new thisUser.ASK.AlexaForBusiness();
            console.log("search AWS contacts");
            var p = thisUser.rc_platform.getPlatform()
            a4b.searchContacts({}, function(err, data) {
                if (err){
                  console.log("Invalid credentials");
                  return res.send({"status":"failed","message":"Invalid AWS credentials"})
                }else{
                    console.log(data);
                    p.get('/restapi/v1.0/account/~/directory/entries')
                      .then(function(resp){
                        var json = resp.json()
                        thisUser.contactList = [];
                        var countId = 0
                        async.each(json.records,
                          function(record, callback){
                              console.log(JSON.stringify(record))
                              console.log("------")
                              if (record.hasOwnProperty("phoneNumbers")) {
                                var lineId = 0
                                for (var i=0; i < record.phoneNumbers.length; i++)  {
                                  if (record.phoneNumbers[i].usageType == "DirectNumber") {
                                    var phoneNumber = record.phoneNumbers[i].phoneNumber
                                    var displayName = record.lastName + " " + record.firstName
                                    var params = {}
                                    params['FirstName'] = record.firstName,
                                    params['DisplayName'] = (lineId == 0) ? displayName : (displayName + " - line " + lineId)
                                    params['LastName'] = record.lastName,
                                    params['PhoneNumber'] = phoneNumber
                                    params['Selected'] = false
                                    params['Id'] = countId
                                    countId++
                                    var numberExisted = false
                                    for (var contact of data['Contacts']){
                                        if (contact['PhoneNumber'] == phoneNumber){
                                        //if (contact['DisplayName'] == displayName){
                                          console.log("number existed: " + contact['PhoneNumber'] + "/" + phoneNumber)
                                          numberExisted = true
                                          break;
                                        }
                                    }
                                    params['ExistInAWS'] = numberExisted
                                    thisUser.contactList.push(params);
                                    lineId++
                                  }
                                }
                                return callback(null, "next number")
                              }else{
                                console.log("contact has no phoneNumbers at all")
                                return callback(null, "next extension")
                              }
                          },
                          function (err){
                            console.log("DONE")
                            res.send('{"status":"ok","message":'+ JSON.stringify(thisUser.contactList) +'}')
                            console.log("SENT")
                          })
                      })
                }
            });
          }); // close writeFile

    },
  logout: function(req, res, callback){
    console.log("LOGOUT FUNC")
    var p = this.getPlatform()
    p.logout()
      .then(function (token) {
        console.log("logged out")
        //p.auth().cancelAccessToken()
        //p = null
        callback(null, "ok")
      })
      .catch(function (e) {
        console.log('ERR ' + e.message || 'Server cannot authorize user');
        callback(e, e.message)
      });
  }
}

module.exports = User;
