function (user, context, callback) {
    var _ = require("lodash");

     // Group ID  of Azure that needs to be match, this is returned in the access token
     const azureGroupId = '59e697f5-fc1c-45bd-90b9-36018f035fe2';


    // verify if the connection is azure ad and the app is the specific app we want to handle 
    if(context.connection === "microsoftonline-waad" && context.clientID === "clientID"){
        var req = context.request;
        
        // Get requested scopes
        var scopes = (req.query && req.query.scope) || (req.body && req.body.scope);
        
        // Normalize scopes into an array
        scopes = (scopes && scopes.split(" ")) || ];
      
        // Restrict the access token scopes according to the current user
        context.accessToken.scope = restrictScopes(user, scopes);
        
        callback(null, user, context);

    }
    callback(null, user, context);


    function restrictScopes(user, requested) {
        // Full list of scopes available hardcoded for demo purposes
        var all = "read:examples", "write:examples";
    
        // Applies hardcoded logic to restrict the possible scopes;
        // replace with your access control logic that can perform
        // external requests or use data available at the user level
        var allowed;
        if(user.group_ids.includes(azureGroupId)){
          allowed = "read:examples"];
        } else {
          allowed = all;
        }
        
        // Intersect allowed with requested to allow the client
        // application to request less scopes than all the ones the
        // user has actually access to. For example, the client
        // application may only want read access even though the
        // user has write access
        return _.intersection(allowed, requested);
      }
       
    

}