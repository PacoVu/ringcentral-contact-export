var deleteArray = new Array()
var isExtensionsChanged = false

function initForReadLog() {
  $( "#fromdatepicker" ).datepicker({ dateFormat: "yy-mm-dd"});
  $( "#todatepicker" ).datepicker({dateFormat: "yy-mm-dd"});
  var pastMonth = new Date();
  var day = pastMonth.getDate()
  var month = pastMonth.getMonth() - 1
  var year = pastMonth.getFullYear()
  if (month < 0){
    month = 11
    year -= 1
  }
  $( "#fromdatepicker" ).datepicker('setDate', new Date(year, month, day));
  $( "#todatepicker" ).datepicker('setDate', new Date());
}
function initForRecordedCalls() {
  var height = $("#menu_header").height()
  height += $("#search_bar").height()
  height += $("#call_list_header").height()
  height += $("#footer").height()

  var h = $(window).height() - (height + 125);
  $("#call_items").height(h)

  window.onresize = function() {
    var height = $("#menu_header").height()
    height += $("#search_bar").height()
    height += $("#call_list_header").height()
    height += $("#footer").height()

    var h = $(window).height() - (height + 125);
    $("#call_items").height(h)
  }

  if (window.navigator.userAgent.indexOf('Win') > -1) {
    var list = window.document.getElementById('call_items');
    if (list.scrollHeight > list.offsetHeight) {
      $('.sentiment_icon_td').css('padding-left', '23px');
    }
  }

  $('#call_items').find('.subject_edit_icon').click(function (e) {
    e.stopPropagation();
    var textElem = $(this).parent().find('span');
    var inputElem = $(this).parent().find('input');
    var uid = $(this).data('uid');
    if ($(this).attr('src').indexOf('edit') > -1) {
      textElem.hide();
      inputElem.show();
      $(this).attr("src", "img/accept.png");
    } else {
      textElem.show();
      inputElem.hide();
      if (inputElem.val() !== textElem.text()) {
        textElem.html(inputElem.val());
        var posting = $.post( "setsubject", {
          uid: uid,
          subject: inputElem.val()
        });
        posting.done(function( response ) {
          var res = JSON.parse(response)
          if (res.status == "error") {
            alert(res.calllog_error)
          }
        });
        posting.fail(function(response){
          alert(response.statusText)
        });
      }
      $(this).attr("src", "img/edit.png");
    }
  });

  $('#call_items').find('.subject_edit_input').click(function(e) {
    e.stopPropagation();
  });

  $('#call_items').find('.subject_edit_input').click(function(e) {
    e.stopPropagation();
  });

  $('#call_items').find('tr').click( function() {
    var index = $(this).index()
    if (window.calls[index].processed == 1){
      var isKeyword = $(this).find('.transcript_brief').find('.keyword').length > 0;
      var searchWord;
      if (!isKeyword) {
        //searchWord = $(this).find('.transcript_brief').data('original-text').replace('...', '').trim();
        searchWord = $(this).find('.transcript_brief').data('original-text').trim();
      }
      openAnalyzed(window.calls[index].uid, searchWord)
    }else if (window.calls[index].processed == 0) {
      var r = confirm("This content has not been transcribed yet.Do you want to transcribe it now?");
      if (r == true) {
        transcribe(window.calls[index].uid, window.calls[index].call_type, window.calls[index].recording_url)
      }
    }else{
      var r = confirm("Transcribing is in progress. Do you want to cancel the transcribing process?");
      if (r == true) {
        cancelTranscribe(window.calls[index].uid)
      }else{
        if (checkTimer == null)
          startPolling(window.calls[index].uid)
        else {
          window.clearInterval(checkTimer)
          checkTimer = null
        }
      }
      //alert("Analysis is not available.")
    }
  });

  $("#search").focus()
  $("#search").select()
  $('#extensionnumbers').on('hidden.bs.select', function () {
    if (window.location.pathname === '/readlog') {
      return;
    }
    if (isExtensionsChanged) {
      startSearch();
    }
  });
}
function selectionHandler(elm){
  if ($(elm).prop("checked")){
    deleteArray = []
    for (var item of calls){
      var eid = "#sel_"+ item.uid
      $(eid).prop('checked', true);
      var item = {}
      item['id'] = item.uid
      item['type'] = item.type
      item['rec_id'] = item.rec_id
      deleteArray.push(item)
    }
  }else{
    for (var item of window.calls){
      var eid = "#sel_"+ item.uid
      $(eid).prop('checked', false);
    }
    deleteArray = []
  }
}
function logout(){
  window.location.href = "index?n=1"
}
function selectSelectText(){
  $("#search").select()
}

function openAnalyzed(id, searchWord){
  var search = $("#search").val()
  post_to_url('/analyze', {
    CallId: id,
    searchWord: searchWord ? searchWord : search,
    searchArg: search
  }, 'post');
}

function post_to_url(path, params, method) {
    method = method || "post";
    var form = document.createElement("form");
    form.setAttribute("method", method);
    form.setAttribute("action", path);
    for(var key in params) {
        if(params.hasOwnProperty(key)) {
            var hiddenField = document.createElement("input");
            hiddenField.setAttribute("type", "hidden");
            hiddenField.setAttribute("name", key);
            hiddenField.setAttribute("value", params[key]);

            form.appendChild(hiddenField);
         }
    }
    document.body.appendChild(form);
    form.submit();
}

function readContacts(){
  var configs = {}
  configs['accessKeyId'] = $("#access_keyid").val()
  configs['secretAccessKey'] = $("#secret_access_key").val()
  configs['region'] = $('#region').val();

  var url = "readcompanycontacts"
  var posting = $.post(url, configs);
  posting.done(function( response ) {
    alert(response)
    var res = JSON.parse(response)
    if (res.status != "ok") {
      alert(res.message)
    }else{
      alert(res.message)
    }
  });
  posting.fail(function(response){
    alert(response.statusText);
  });
}

function test(){
  var configs = {}
  configs['accessKeyId'] = $("#access_keyid").val()
  configs['secretAccessKey'] = $("#secret_access_key").val()
  configs['region'] = $('#region').val();

  var url = "test"
  var posting = $.post(url, configs);
  posting.done(function( response ) {
    alert(response)
    var res = JSON.parse(response)
    if (res.status != "ok") {
      alert(res.message)
    }else{
      alert(res.message)
    }
  });
  posting.fail(function(response){
    alert(response.statusText);
  });
}


function selectForDelete(elm, cid, type, rec_id){
  var eid = "#sel_"+cid
  if ($(eid).prop("checked")){
    var item = {}
    item['id'] = cid
    item['type'] = type
    item['rec_id'] = rec_id
    deleteArray.push(item)
  }else{
    for (var i = 0; i < deleteArray.length; i++){
      if (deleteArray[i].id == cid){
        deleteArray.splice(i, 1)
        break
      }
    }
  }
}
function confirmRemoveSelectedItemsFromDB(){
  var r = confirm("Do you really want to remove selected calls from local database?");
  if (r == true) {
    removeSelectedItemsFromLocalDB()
  }
}

function confirmDeleteSelectedItemsFromCallLogDb(){
  if (deleteArray.length <= 0 )
    return
  var r = confirm("Do you really want to delete selected calls from RingCentral call log database?");
  if (r == true) {
    deleteSelectedItemsFromCallLogDb()
  }
}

function removeSelectedItemsFromLocalDB(){
  var configs = {}
  configs['calls'] = JSON.stringify(deleteArray)
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
  configs['calls'] = JSON.stringify(deleteArray)
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

function extensionsChanged(e) {
  isExtensionsChanged = true
}
