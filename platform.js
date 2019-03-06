var RC = require('ringcentral')
var fs = require('fs')
var async = require("async");
require('dotenv').load()


function RCPlatform(userObj, mode) {
  this.token_json = null
  this.subscriptionId = ""
  this.extensionId = ""
  this.accountId = ""
  this.parent = userObj
  var rcsdk = null
  if (mode == "production"){
    rcsdk = new RC({
      server:RC.server.production,
      appKey: process.env.CLIENT_ID_PROD,
      appSecret:process.env.CLIENT_SECRET_PROD
    })
  }else if (mode == "sandbox"){
    rcsdk = new RC({
      server:RC.server.sandbox,
      appKey: process.env.CLIENT_ID_SB,
      appSecret:process.env.CLIENT_SECRET_SB
    })
  }
  this.platform = rcsdk.platform()
  return this
}

RCPlatform.prototype = {
  setAccountId: function(accountId){
    this.accountId = accountId
  },
  login: function(code, callback){
    var thisPlatform = this
    this.platform.login({
      code: code,
      redirectUri: process.env.RC_APP_REDIRECT_URL
    })
    .then(function (token) {
      var json = token.json()
      //console.log("ACCOUNT INFO" + JSON.stringify(json))
      var newToken = {}
      newToken['access_token'] = json.access_token
      newToken['expires_in'] = json.expires_in
      newToken['token_type'] = json.token_type
      newToken['refresh_token'] = json.refresh_token
      newToken['refresh_token_expires_in'] = json.refresh_token_expires_in
      newToken['login_timestamp'] = Date.now() / 1000
      //console.log("ACCESS-TOKEN-EXPIRE-IN: " + json.expires_in)
      //console.log("REFRESH-TOKEN-EXPIRE-IN: " + json.refresh_token_expires_in)
      thisPlatform.token_json = newToken
      thisPlatform.extensionId = json.owner_id
      return callback(null, json.owner_id)
    })
    .catch(function (e) {
      console.log('PLATFORM LOGIN ERROR ' + e.message || 'Server cannot authorize user');
      return callback(e, e.message)
    });
  },
  logout: function(){
    this.platform.logout()
  },
  getPlatform: function(){
    var token = this.token_json
    if (token == null)
      return this.platform
    var timestamp = Date.now() / 1000
    var consumedTime = (timestamp - token.login_timestamp)
    console.log("CONSUMED: " + consumedTime)
    token.login_timestamp = timestamp
    token.expires_in = token.expires_in - consumedTime
    if (token.expires_in < 0)
      token.expires_in = 0
    token.refresh_token_expires_in = token.refresh_token_expires_in - consumedTime
    if (token.refresh_token_expires_in < 0)
      token.refresh_token_expires_in = 0
    this.token_json = token
    var thisPlatform = this.platform
    var data = this.platform.auth().data();
    data.token_type = token.token_type
    data.expires_in = token.expires_in
    data.access_token = token.access_token
    data.access_token_ttl = 3600
    data.refresh_token_expires_in = token.refresh_token_expires_in
    this.platform.auth().setData(data)

    if (this.platform.auth().accessTokenValid()) { // access token is still valid
      console.log("ACCESS TOKEN VALID: " + token.expires_in)
      return this.platform
    }else if (this.platform.auth().refreshTokenValid()) {
      // access token expired => check refresh_token
      console.log("ACCESS TOKEN EXPIRED: " + token.expires_in)
      // refresh token
      this.platform.on(this.platform.events.refreshError, function(e){
        console.log("CAN'T REFRESF: " + e.message)
      });
      this.platform.on(this.platform.events.refreshSuccess, function(e){
        console.log("REFRESH SUCCESS")
        var data = thisPlatform.auth().data();
        token.token_type = data.token_type
        token.expires_in = data.expires_in
        token.access_token = data.access_token
        token.refresh_token_expires_in = data.refresh_token_expires_in
        token.login_timestamp = Date.now() / 1000
        console.log("NEW TOKEN: " + JSON.stringify(token))
        this.token_json = token
      });
      this.platform.refresh()
      return this.platform
    }else{
      // forceLogin
      console.log("BOTH TOKEN TOKENS EXPIRED")
      return null
    }
  }
}

module.exports = RCPlatform;
/*
const randomize = require('randomatic');
function generateRandomCode(digits) {
  var code = randomize('0', digits);
  return code
}
getSubscriptionId: function(){
  return this.subscriptionId
},

renewSubscription: function(subId, callback){
  var thisPlatform = this
  this.platform.get('/subscription')
    .then(function (response) {
      var json = response.json();
      if (json.records.length > 0){
        var found = false
        for(var record of json.records) {
          console.log(record)
          if (subId == record.id){
            found = true
            thisPlatform.platform.post('/subscription/' + subId + "/renew")
              .then(function (response) {
                var json = response.json()
                console.log("RENEW SUCCESS")
                return callback(null, "RENEWED")
              })
              .catch(function(e){
                return callback(e, "CREATE")
              })
            break
          }
        }
        if (found == false){
          console.log("no match")
          return callback(null, "CREATE")
        }
      }else{
        return callback(null, "CREATE")
      }
    })
    .catch(function(e) {
      console.error(e);
      callback(e, e.message)
    });
},
checkExistingSubscription: function(callback){
  if (this.subscriptionId != ""){
    // check and renew this subscription
    var thisPlatform = this
    console.log("subscriptionId exists")
    this.platform.post('/subscription/' + this.subscriptionId + "/renew")
      .then(function (response) {
        var json = response.json()
        callback(null, "RENEWED")
      })
      .catch(function(e){
        callback(e, "CREATE")
      })
  }else{
    // check if subscription exists in RC server
    console.log("no subscriptionId")
    var thisPlatform = this
    var refFilter = "/restapi/v1.0/account/" + this.accountId +"/extension/"+ this.extensionId +"/presence?detailedTelephonyState=true"
    this.platform.get('/subscription')
      .then(function (response) {
        var json = response.json();
        if (json.records.length > 0){
          for(var record of json.records) {
            console.log(record)
            //var foundFilter = false
            for (var filter of record.eventFilters){
              if (filter == refFilter){
                return thisPlatform.platform.delete('/subscription/' + record.id)
                  .then(function (response) {
                    console.log("deleted by filter: " + record.id)
                    callback(null, "CREATE")
                  })
                  .catch(function(e) {
                    console.error(e);
                    callback(e, "CREATE")
                  });
                //foundFilter = true
                //break
              }
            }
          }
          //if (foundFilter == false){
            console.log("no match")
            return callback(null, "CREATE")
          //}
        }else{
          callback(null, "CREATE")
        }
      })
      .catch(function(e) {
        console.error(e);
        callback(e, e.message)
      });
  }
},

*/
