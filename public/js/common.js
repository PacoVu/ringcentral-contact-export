// new feature
function findSimilar(uid){
  var method = "post";
  var form = document.createElement("form");
  form.setAttribute("method", method);
  form.setAttribute("action", "findsimilar");
  var hiddenField = document.createElement("input");
  hiddenField.setAttribute("type", "hidden");
  hiddenField.setAttribute("name", "uid");
  hiddenField.setAttribute("value", uid);
  form.appendChild(hiddenField);
  document.body.appendChild(form);
  form.submit();
}
