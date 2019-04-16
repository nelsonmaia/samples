function (user, context, callback) {
    
    
    var scopes = context.request.query.scope;
    
    scopes = (scopes && scopes.split(" ")) || [];
    
    console.log("contains openid", scopes.includes("openid"));
    
    if(scopes.includes("openid")){
       context.multifactor = {
          provider: 'any',
          allowRememberBrowser: false
        };
    }
  
    callback(null, user, context);
  }