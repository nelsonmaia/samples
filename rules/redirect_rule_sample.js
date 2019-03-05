function (user, context, callback) {
  
    // Check if user is accessing this rule without being redirected back
    if (context.protocol !== "redirect-callback") {
        
        // Assuming accountMigratedFlag is the flat that the user is migrated
        if (user.app_metadata.accountMigratedFlag) {
            // User has initiated a login and is forced to change their password
            // Send user's information in a JWT to avoid tampering
            function createToken(clientId, clientSecret, issuer, user) {
              var options = {
                expiresInMinutes: 5,
                audience: clientId,
                issuer: issuer
              };
              return jwt.sign(user, clientSecret, options);
            }
            var token = createToken(
              configuration.CLIENT_ID,
              configuration.CLIENT_SECRET,
              configuration.ISSUER, {
                sub: user.user_id,
                email: user.email
              }
            );
            context.redirect = {
              url: "https://example.com/migrateAccount?token=" + token
            };
            return callback(null, user, context);
          }
      
    }else{
        // After the user is redirect back to auth0 
        return callback(null, user, context);
    }
  }