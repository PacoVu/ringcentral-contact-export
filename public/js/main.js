var totalContacts = 0
var totalSelectableContacts = 0

function init() {
  var height = $("#menu_header").height()
  height += $("#button_header").height()
  height += $("#table_header").height()
  height += $("#footer").height()
  var h = $(window).height() - (height + 40);
  $("#contact_list").height(h)

  window.onresize = function() {
    var height = $("#menu_header").height()
    height += $("#button_header").height()
    height += $("#table_header").height()
    height += $("#footer").height()
    var h = $(window).height() - (height + 40);
    $("#contact_list").height(h)
  }

  for (var i=0; i<window.contactList.length; i++){
    if (window.contactList[i].ExistInAWS == false){
      totalSelectableContacts++
    }
  }
  $("#indication").text("Selected: " + 0 +"/" + totalSelectableContacts + " contacts.")
}

function exportContacts(){
  var contactList = []
  for (var contact of window.contactList){
      if (contact.Selected){
        var item = {
          'LastName': contact.LastName,
          'FirstName': contact.FirstName,
          'DisplayName': contact.DisplayName,
          'PhoneNumber': contact.PhoneNumber
        }
        contactList.push(item)
      }
  }
  if (contactList.length == 0)
    return alert("Please select contact(s) to export!")
  else{
    $("#export_contact").prop("disabled", true);
    $("#exportIcon").css('display', 'inline');
    var configs =  {}
    configs['contacts'] = JSON.stringify(contactList)
    var url = "exportcontacts"
    var posting = $.post( url, configs );
    posting.done(function( response ) {
      var res = JSON.parse(response)
      if (res.status != "ok") {
        alert(res.calllog_error)
      }else{
        window.location = "exportcontact"
      }
    });
    posting.fail(function(response){
      alert(response.statusText);
    });
  }
}
function selectionHandler(elm){
    var selected = false
    if ($(elm).prop("checked")){
      selected = true
    }
    for (var i=0; i<window.contactList.length; i++){
      if (window.contactList[i].ExistInAWS == false){
        var eid = "#sel_"+ window.contactList[i].Id
        $(eid).prop('checked', selected);
        window.contactList[i].Selected = selected;
      }
    }
    updateSelectionCount()
}

function selectForSync(elm, id){
  var eid = "#sel_"+ id
  if ($(eid).prop("checked")){
    window.contactList[id].Selected = true;
  }else{
    window.contactList[id].Selected = false;
  }
  updateSelectionCount()
}
function updateSelectionCount(){
  var selectionCount = 0
  for (var i=0; i<window.contactList.length; i++){
    if (window.contactList[i].Selected == true){
      selectionCount++
    }
  }
  $("#indication").text("Selected: " + selectionCount +"/" + totalSelectableContacts + " contacts.")
}

function logout(){
  window.location.href = "index?n=1"
}

function readContacts(){
  $("#readcontacts").prop("disabled", true);
  $("#logginIcon").css('display', 'inline');
  var configs = {}
  configs['accessKeyId'] = $("#access_keyid").val()
  configs['secretAccessKey'] = $("#secret_access_key").val()
  configs['region'] = $('#region').val();
  var url = "readcompanycontacts"
  var posting = $.post( url, configs );
  posting.done(function( response ) {
    var res = JSON.parse(response)
    if (res.status != "ok") {
      $("#readcontacts").prop("disabled", false);
      $("#logginIcon").css('display', 'none');
      alert(res.message)
    }else{
      window.location = "exportcontact"
    }
  });
  posting.fail(function(response){
    $("#readcontacts").prop("disabled", false);
    $("#logginIcon").css('display', 'none');
    alert("Error. Please try again.");
  });
}

function disableAllInput(disable){
  var elems = document.getElementsByTagName('button');
  var len = elems.length;
  if (disable == true){
    for (var i = 0; i < len; i++) {
        elems[i].disabled = true;
    }
  }else{
    for (var i = 0; i < len; i++) {
        elems[i].disabled = false;
    }
  }
}

function confirmRemove(id){
  var r = confirm("Do you really want to remove this call from local database?");
  if (r == true) {
    removeFromLocalDB(id)
  }
}

function removeFromLocalDB(id){
  var configs = {}
  configs['id'] = id
  var url = "remove"
  var posting = $.post(url, configs)
  posting.done(function(response) {
    var res = JSON.parse(response)
    if (res.status == "error") {
      alert("error")
    }else{
      window.location = "recordedcalls"
    }
  });
  posting.fail(function(response){
    alert(response.statusText)
  });
}

function confirmDelete(id, type, rec_id) {
  var r = confirm("Do you really want to delete this call from RingCentral call log database?");
  if (r == true) {
    deleteFromDB(id, type, rec_id)
  }
}


function confirmRemoveSelectedItemsFromDB(){
  var r = confirm("Do you really want to remove selected calls from local database?");
  if (r == true) {
    removeSelectedItemsFromLocalDB()
  }
}

function confirmDeleteSelectedItemsFromCallLogDb(){
  if (contactArray.length <= 0 )
    return
  var r = confirm("Do you really want to delete selected calls from RingCentral call log database?");
  if (r == true) {
    deleteSelectedItemsFromCallLogDb()
  }
}

function removeSelectedItemsFromLocalDB(){
  var configs = {}
  configs['calls'] = JSON.stringify(contactArray)
  var url = "remove"
  var posting = $.post(url, configs)
  posting.done(function(response) {
    var res = JSON.parse(response)
    if (res.status == "error") {
      alert("error")
    }else{
      window.location = "recordedcalls"
    }
  });
  posting.fail(function(response){
    alert(response.statusText)
  });
}

function deleteSelectedItemsFromCallLogDb(){
  var configs = {}
  configs['calls'] = JSON.stringify(contactArray)
  var url = "delete"
  var posting = $.post(url, configs)
  posting.done(function(response) {
    var res = JSON.parse(response)
    if (res.status == "error") {
      alert(res.calllog_error)
    }else{
      window.location = "recordedcalls"
    }
  });
  posting.fail(function(response){
    alert(response.statusText)
  });
}
