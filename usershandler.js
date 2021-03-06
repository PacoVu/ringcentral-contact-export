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
  this.sortFirstNameDirection = "none"
  this.sortLastNameDirection = "none"
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
    loadReadContactPage: function(req, res){
      res.render('readcontact', {
          userName: this.getUserName(),
          contactList: this.contactList
        })
    },
    loadExportContactPage: function(req, res){
      res.render('exportcontact', {
          userName: this.getUserName(),
          sortLastName: this.sortLastNameDirection,
          sortFirstName: this.sortFirstNameDirection,
          contactList: this.contactList
      })
    },
    reloadContactsPage: function(req, res){
      console.log("reloadContactsPage")
      if (this.contactList.length){
        if (req.query.sortfield == 'lastname'){
          if (this.sortLastNameDirection == "ascend"){
            this.sortLastNameDirection = "descend"
            this.contactList.sort(sortLastNameDescend)
          }else{
            this.sortLastNameDirection = "ascend"
            this.contactList.sort(sortLastNameAscend)
          }
          this.sortFirstNameDirection = "none"
        }else if (req.query.sortfield == 'firstname'){
          if (this.sortFirstNameDirection == "ascend"){
            this.sortFirstNameDirection = "descend"
            this.contactList.sort(sortFirstNameDescend)
          }else{
            this.sortFirstNameDirection = "ascend"
            this.contactList.sort(sortFirstNameAscend)
          }
          this.sortLastNameDirection = "none"
        }

        console.log("sort by " + req.query.sortfield)
        res.render('exportcontact', {
          userName: this.getUserName(),
          sortLastName: this.sortLastNameDirection,
          sortFirstName: this.sortFirstNameDirection,
          contactList: this.contactList
        })
      }
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
      var thisUser = this
      //var ASK = require('aws-sdk');
      var fileName = "aws/" + this.getExtensionId()  + "_configs.json"
      fs.writeFile(fileName, JSON.stringify(req.session.configs), function(err) {
          if(err) {
              console.log(err);
              return res.send('{"status":"failed","message":"Cannot write configs file."}')
          }
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
                    return callback(null, data)
                  }
                });
            },
            function (err){
              console.log("DONE EXPORT")
              setTimeout(function(){
                thisUser.updateCompanyContactsSync(req, res, a4b, thisUser)
              }, 1000)
            })
      })
    },
    updateCompanyContactsSync: function(req, res, a4b, thisUser){
        console.log("updateCompanyContactsSync")
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
                       if (record.status == "Enabled"){
                          if (record.hasOwnProperty("phoneNumbers")) {
                              if (record.hasOwnProperty("lastName") || record.hasOwnProperty("firstName")) {
                                var lineId = 0
                                var firstNumber = true
                                for (var i=0; i < record.phoneNumbers.length; i++)  {
                                  if (record.phoneNumbers[i].usageType == "DirectNumber" &&
                                      record.phoneNumbers[i].type == "VoiceFax") {
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
                                    params['ExtNum'] = record.extensionNumber
                                    countId++
                                    var numberExisted = false
                                    for (var contact of data['Contacts']){
                                        if (contact['PhoneNumber'] == phoneNumber){
                                        //if (contact['DisplayName'] == displayName){
                                          numberExisted = true
                                          break;
                                        }
                                    }
                                    params['ExistInAWS'] = numberExisted
                                    //if (i == record.phoneNumbers.length - 1)
                                    if (firstNumber){
                                      params['AddDivider'] = true
                                      firstNumber = false
                                    }else{
                                      params['AddDivider'] = false
                                    }
                                    thisUser.contactList.push(params);
                                    lineId++
                                  }
                                }
                              }
                            }
                        }
                    }
                    //thisUser.contactList.sort(sortLastName)
                    res.send('{"status":"ok","message":"Contacts list is ready."}')
                    //res.send('{"status":"ok","message":'+ JSON.stringify(thisUser.contactList) +'}')
                  })
                  .catch(function(e){
                    console.log("Read company contact failed")
                    res.send('{"status":"failed","message":'+ JSON.stringify(e) +'}')
                  })
            }
        });
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
            thisUser.ASK.config.loadFromPath("./"+fileName);
            fs.unlinkSync(fileName);
            var a4b = new thisUser.ASK.AlexaForBusiness();
            var p = thisUser.rc_platform.getPlatform()
            a4b.searchContacts({}, function(err, data) {
                if (err){
                  console.log("Invalid credentials");
                  return res.send({"status":"failed","message":"Invalid AWS credentials"})
                }else{
                    //console.log(data);
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
                          //console.log(JSON.stringify(record))
                          //console.log("------")
                          if (record.status == "Enabled"){
                            if (record.hasOwnProperty("phoneNumbers")) {
                              if (record.hasOwnProperty("lastName") || record.hasOwnProperty("firstName")) {
                                var lineId = 0
                                var firstNumber = true
                                for (var i=0; i < record.phoneNumbers.length; i++)  {
                                  if (record.phoneNumbers[i].usageType == "DirectNumber" &&
                                      record.phoneNumbers[i].type == "VoiceFax") {
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
                                    params['ExtNum'] = record.extensionNumber
                                    countId++
                                    var numberExisted = false
                                    for (var contact of data['Contacts']){
                                        if (contact['PhoneNumber'] == phoneNumber){
                                        //if (contact['DisplayName'] == displayName){
                                          numberExisted = true
                                          break;
                                        }
                                    }
                                    params['ExistInAWS'] = numberExisted
                                    //if (i == record.phoneNumbers.length - 1)
                                    if (firstNumber){
                                      params['AddDivider'] = true
                                      firstNumber = false
                                    }else{
                                      params['AddDivider'] = false
                                    }
                                    thisUser.contactList.push(params);
                                    lineId++
                                  }
                                }
                              }
                            }
                          }
                        }
                        //thisUser.contactList.sort(sortLastName)
                        res.send('{"status":"ok","message":"Contacts list is ready."}')
                        //res.send('{"status":"ok","message":'+ JSON.stringify(thisUser.contactList) +'}')
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
            //console.log("load AWS configs");
            thisUser.ASK.config.loadFromPath("./"+fileName);
            fs.unlinkSync(fileName);
            var a4b = new thisUser.ASK.AlexaForBusiness();
            //console.log("search AWS contacts");
            var p = thisUser.rc_platform.getPlatform()
            a4b.searchContacts({}, function(err, data) {
                if (err){
                  console.log("Invalid credentials");
                  return res.send({"status":"failed","message":"Invalid AWS credentials"})
                }else{
                    //console.log(data);
                    p.get('/restapi/v1.0/account/~/directory/entries')
                      .then(function(resp){
                        var json = resp.json()
                        thisUser.contactList = [];
                        var countId = 0
                        async.each(json.records,
                          function(record, callback){
                              //console.log(JSON.stringify(record))
                              //console.log("------")
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
                                return callback(null, "next extension")
                              }
                          },
                          function (err){
                            console.log("DONE")
                            thisUser.contactList.sort(sortLastName)
                            res.send('{"status":"ok","message":'+ JSON.stringify(thisUser.contactList) +'}')
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
function sortLastNameAscend(a,b) {
  //return a.LastName == b.LastName ? 0 : a.LastName < b.LastName ? -1 : 1;
  return a.LastName.localeCompare(b.LastName, 'en', {sensitivity: 'base'})
}
function sortFirstNameAscend(a,b) {
  //return a.FirstName == b.FirstName ? 0 : a.FirstName < b.FirstName ? -1 : 1;
  return a.FirstName.localeCompare(b.FirstName, 'en', {sensitivity: 'base'})
}

function sortLastNameDescend(a,b) {
  //return a.LastName == b.LastName ? 0 : a.LastName > b.LastName ? -1 : 1;
  return (a.LastName.localeCompare(b.LastName, 'en', {sensitivity: 'base'})) * -1
}
function sortFirstNameDescend(a,b) {
  //return a.FirstName == b.FirstName ? 0 : a.FirstName > b.FirstName ? -1 : 1;
  return (a.FirstName.localeCompare(b.FirstName, 'en', {sensitivity: 'base'})) * -1
}
module.exports = User;
