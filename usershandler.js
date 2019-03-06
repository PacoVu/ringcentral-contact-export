var RC = require('ringcentral')
var fs = require('fs')
var async = require("async");
//var ASK = require('aws-sdk');

const RCPlatform = require('./platform.js')
require('dotenv').load()

function User(id, mode) {
  this.id = id;
  this.admin = false;
  this.userName = "Phong Van";
  this.extensionId = "";
  this.extIndex = 0
  this.token_json = {};
  this.rc_platform = new RCPlatform(this, mode)
  return this
}

User.prototype = {
    setExtensionId: function(id) {
      this.extensionId = id
    },
    getExtensionId: function(id) {
      return this.extensionId
    },
    setAdmin: function() {
      this.admin = true
    },
    setUserToken: function (token_json){
      this.token_json = token_json
    },
    getUserId: function(){
      return this.id
    },
    isAdmin: function(){
      return this.admin
    },
    getUserToken: function () {
      return this.token_json;
    },
    getPlatform: function(){
      return this.rc_platform.getPlatform()
    },
    getUserLevel: function(){
      var userLevel = ''
      if (this.getUserId() == 100)
        userLevel = 'demo'
      else{
        if (this.isAdmin())
          userLevel = 'admin'
        else
        userLevel = 'standard'
      }
      return userLevel
    },
    loadContactsPage: function(req, res){
        res.render('readcontact', {
          userLevel: this.getUserLevel(),
          userName: this.userName,
          contactList: []
        })
    },
    login: function(req, res, callback){
      var thisReq = req
      if (req.query.code) {
        console.log("CALL LOGIN FROM USER")
        var platform = this.rc_platform
        var thisUser = this
        platform.login(req.query.code, function (err, extensionId){
          if (!err){
            thisUser.extensionId = extensionId
            req.session.extensionId = extensionId;
            console.log("EXTENSION ID: " + thisUser.extensionId)
            console.log('logged_in');
            callback(null, extensionId)
            //var thisRes = res
            var p = thisUser.getPlatform()
            console.log('passed getPlatform');
            p.get('/account/~/extension/~/')
              .then(function(response) {
                //console.log(response)
                var jsonObj = response.json();
                //console.log(JSON.stringify(jsonObj))
                //console.log("Account Id: " + jsonObj.account.id)
                thisUser.rc_platform.setAccountId(jsonObj.account.id)
                res.send('login success');
                if (jsonObj.permissions.admin.enabled){
                  thisUser.setAdmin(true)
                }
                thisUser.userName = jsonObj.contact.firstName + " " + jsonObj.contact.lastName
                console.log(thisUser.userName)
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
    },
    readCompanyContactsAsync: function(req, res){
        // write aws credentials to temp file
        var ASK = require('aws-sdk');
        var fileName = "aws/" + this.getExtensionId()  + "_configs.json"
        var thisUser = this
        var thisRes = res
        fs.writeFile(fileName, JSON.stringify(req.body), function(err) {
            if(err) {
                console.log(err);
                res.send({"status":"failed","message":"Cannot write configs file."})
            }
            ASK.config.loadFromPath("./"+fileName);
            var a4b = new ASK.AlexaForBusiness();
            //readAWSContacts(a4b, callback)
            a4b.searchContacts({}, function(err, data) {
                if (err) console.log(err, err.stack); // an error occurred
                else{
                    console.log(data);           // successful response
                    var p = thisUser.rc_platform.getPlatform()
                    p.get('/restapi/v1.0/account/~/directory/entries')
                      .then(function(resp){
                        var json = resp.json()
                        console.log("Count 1: " + json.records.length)
                        var contactList = [];
                        async.each(json.records,
                          function(record, callback){
                              console.log(JSON.stringify(record))
                              //createAWSContact(a4b, record)
                              console.log("------")
                              var phoneNumber = ""
                              if (record.hasOwnProperty("phoneNumbers")) {
                                //console.log("record has phoneNumber")
                                for (var i=0; i < record.phoneNumbers.length; i++)  {
                                  //console.log("item: " + JSON.stringify(record.phoneNumbers[i]))
                                  if (record.phoneNumbers[i].usageType == "DirectNumber") {
                                    var newNumber = record.phoneNumbers[i].phoneNumber
                                    //console.log("DirectNumber: " + newNumber)
                                    var numberExisted = false
                                    for (var contact of data['Contacts']){
                                        //console.log("Contact PhoneNumber: " + contact['PhoneNumber'])
                                        if (contact['PhoneNumber'] == newNumber){
                                          console.log("number existed: " + contact['PhoneNumber'] + "/" + newNumber)
                                          numberExisted = true
                                          break;
                                        }
                                    }
                                    if (!numberExisted){
                                      phoneNumber = newNumber
                                      break
                                    }
                                  }
                                }

                                if (phoneNumber != ""){
                                    var params = {
                                        FirstName: record.firstName,
                                        DisplayName: record.lastName + " " + record.firstName,
                                        LastName: record.lastName,
                                        PhoneNumber: phoneNumber
                                    };
                                    contactList.push(params);
                                    a4b.createContact(params, function(err, data) {
                                      if (err){
                                        //console.log(err, err.stack); // an error occurred
                                        return callback(null, null)
                                      }else{
                                        console.log(data);           // successful response
                                        return callback(null, data)
                                      }
                                    });
                                }else{
                                  console.log("contact has no direct phone number")
                                  return callback(null, null)
                                }
                              }else{
                                console.log("contact has no phoneNumbers at all")
                                return callback(null, null)
                              }
                          },
                          function (err){
                            //console.log("function err")
                            console.log("DONE")
                            fs.unlinkSync(fileName);
                            //return thisRes.send({"status":"ok","message":contactList})
                            return thisRes.send("ok")
                          })
                        })
                }
            });
        });

    },
    readExtensionAsync: function(req, callback){
      var contactList = []
      contactList.push({"status":"ok","message":"test call"})

      var p = this.getPlatform()
      console.log('passed getPlatform');
      p.get('/account/~/extension/~/')
        .then(function(response) {
          var jsonObj = response.json();
          callback(null, jsonObj)
        })
        .catch(function(e) {
          console.log("Failed")
          console.error(e);
          callback("error", e.message)
        });
    },
    readCompanyContacts: function(req, res, callback){
        // write aws credentials to temp file
        var thisUser = this
        //var p = this.rc_platform.getPlatform()
        var p = this.getPlatform()
        var thisRes = res
        p.get('/restapi/v1.0/account/~/directory/entries')
          .then(function(resp){
              thisRes.send('{"status":"ok", "message":"return nothing"}')
              var json = resp.json()
              console.log("Count 1: " + json.records.length)
              var contactList = [];
              for (var record of json.records){
                console.log(JSON.stringify(record))
                if (record.hasOwnProperty("phoneNumbers")) {
                  //console.log("record has phoneNumber")
                  for (var i=0; i < record.phoneNumbers.length; i++)  {
                    //console.log("item: " + JSON.stringify(record.phoneNumbers[i]))
                    if (record.phoneNumbers[i].usageType == "DirectNumber") {
                      var params = {
                          FirstName: record.firstName,
                          DisplayName: record.lastName + " " + record.firstName,
                          LastName: record.lastName,
                          PhoneNumber: record.phoneNumbers[i].phoneNumber
                      };
                      contactList.push(params);
                    }
                  }
                }else{
                  console.log("contact has no phoneNumbers at all")
                }
              }
              console.log("DONE READ")
              callback(null, contactList)
              /*
              thisRes.render('readcontact', {
                userLevel: thisUser.getUserLevel(),
                userName: thisUser.userName,
                contactList: contactList
              })
              //res.send('{"status":"ok", "message":"return contacts list"}')
              console.log("SENT")
              */
              //thisRes.send(JSON.stringify({"status":"ok","message":contactList}))
            })
            .catch(function (e){
              thisReq.send('{"status":"failed", "message":"Cannot read company contacts"}')
            })
    }
}

function readAWSContacts(a4b, callback){
  a4b.searchContacts({}, function(err, data) {
      if (err){
        console.log(err, err.stack); // an error occurred
        callback(err, null)
      }else{
           console.log(data);           // successful response
           callback(null, data)
      }
  });
}
function createAWSContact(a4b, record){
    if (record.hasOwnProperty("businessPhone")) {
        var params = {
            //ClientRequestToken: record.id,
            FirstName: record.firstName,
            DisplayName: record.lastName + " " + record.firstName,
            LastName: record.lastName,
            PhoneNumber: record.businessPhone
        };

        a4b.createContact(params, function(err, data) {
          if (err) console.log(err, err.stack); // an error occurred
          else     console.log(data);           // successful response
        });
    }else{
      console.log("contact has no biz phone number")
    }

}

module.exports = User;
