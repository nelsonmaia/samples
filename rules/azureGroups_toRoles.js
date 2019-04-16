function (user, context, callback) {

    if(context.connection === "microsoftonline-waad" && context.clientID === "uCXX7yjxPsEVRV5zQy4aRbRlHAY9I9u7"){
        console.log("context connection is", context.connection);
        console.log("context ", context );
    
        var request = require("request");
    
        user.app_metadata = user.app_metadata || {};
    
        var addRolesToUser = function (user, cb) {
            // Mapping of Read Users Role to Azure AD Group
            const azureGroupId = '59e697f5-fc1c-45bd-90b9-36018f035fe2';
            const read_usersRoleId = 'rol_mur1djLtms2HtMm3';
            const read_usersRole = 'read_users';
            // --- //
    
            var rolesToAdd = [];
            var rolesToDelete = [];
    
            var assignedRoles = (context.authorization || {}).roles;
    
            console.log("assignedRoles is ", assignedRoles);
    
            console.log("groups ids",user.group_ids);
    
            console.log("Assure groups includes the group for this role", user.group_ids && user.group_ids.includes(azureGroupId));
    
            console.log("User already contain the assignRole ", (assignedRoles || {}).includes(read_usersRole));
    
            const azureContainsReadUserGroup = user.group_ids && user.group_ids.includes(azureGroupId);
            const userRolesChanged = (assignedRoles || {}).includes(read_usersRole);
    
            // Check if the ReadUsers role needs to be added
            if(azureContainsReadUserGroup){
                rolesToAdd.push(read_usersRoleId);
            }else{
                rolesToDelete.push(read_usersRoleId);
            }
            
            // Verify if the user from AD contains the specific group. This could be checking multiple groups and doing multiple matches
            if ((azureContainsReadUserGroup && !userRolesChanged) || (!azureContainsReadUserGroup && userRolesChanged) ) {
    
                // If the roles are not up to date, we will add. This step is very important to avoid unnecessary calls into Management API
                     // Check if the access token for machine to machine is cacheed
                    if (!global.m2mToken) {
    
                        var AuthenticationClient = require('auth0@2.14.0').AuthenticationClient;
                        // Cache the machine to machine token into context.global
                        var mgmt = new AuthenticationClient({
                            domain: 'delegateadmin.eu.auth0.com',
                            clientId: 'CLIENT ID ',
                            clientSecret: 'CLIENT_SECRET',
                        });
        
                        mgmt.clientCredentialsGrant(
                            {
                                audience: 'management api '
                            },
                            function (err, response) {
                                if (err) {
                                    console.log("err", err);
                                    callback(err);
                                }
        
                                console.log("access token is", response.access_token);
        
                                var m2mAccessToken = response.access_token;
                                global.m2mToken = m2mAccessToken;
                                // THe ID of read_users role
                                cb(null, rolesToAdd, global.m2mToken);
        
                            }
                        );
        
                    } else {
                        cb(null, rolesToAdd, global.m2mToken);
                    }
                  
            }else{
                // All the roles are already mapped
                callback(null, user, context);
            }  
        };
    
        addRolesToUser(user, function (err, roles, m2mAccessToken) {
            if (err) {
                callback(err);
            } else {
    
                console.log("Adding roles to the user using Management API");
    
                var url = 'https://' + auth0.domain + '/api/v2/users/' + user.user_id + '/roles';
    
                console.log("Adding roles to the user using Management API call", url);
    
                if(roles === []){
                    roles = null;
                }
    
                console.log("roles for user", roles);
    
                var options = {
                    method: 'POST',
                    url: url,
                    headers:
                    {
                        'cache-control': 'no-cache',
                        authorization: 'Bearer ' + m2mAccessToken,
                        'content-type': 'application/json'
                    },
                    body: { roles: roles },
                    json: true
                };
    
                request(options, function (error, response, body) {
                    if (error) callback(error);
    
                    console.log("this is the body", body);
                    callback(null, user, context);
                });
    
            }
    
        });
    }

    

}