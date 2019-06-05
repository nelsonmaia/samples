// Prerequisites:
// 1. Implement a `mustChangePassword` function
// 2. Set configuration variables for the following:
// * CLIENT_ID
// * CLIENT_SECRET
// * ISSUER

function (user, context, callback) {

  function createToken(clientId, clientSecret, issuer, user) {

    var options = {
      expiresInMinutes: 5,
      audience: clientId,
      issuer: issuer
    };
    return jwt.sign(user, clientSecret, options);
  }

  function verifyToken(clientId, clientSecret, issuer, token, cb) {
    jwt.verify(
      token,
      clientSecret, {
        audience: clientId,
        issuer: issuer
      },
      cb
    );
  }

  function postVerify(err, decoded) {
    if (err) {
      return callback(new UnauthorizedError("Profile verify failed"));
    } else {
      // User's password has been changed successfully

      // TODO custom code with logic

      console.log("This is the original token decoded", decoded);

      console.log("User ID to merge", context.request.query.userId);



      return callback(null, user, context);
    }
  }

  function mergeAccount(userId){
    const userApiUrl = auth0.baseUrl + '/users';
    const userSearchApiUrl = auth0.baseUrl + '/users/' + userId;
  
    request({
     url: userSearchApiUrl,
     headers: {
       Authorization: 'Bearer ' + auth0.accessToken
     }
    },
    function (err, response, body) {
      if (err) return callback(err);
      if (response.statusCode !== 200) return callback(new Error(body));
  
      var data = JSON.parse(body);
      // Ignore non-verified users and current user, if present
      // TODO to verify if it is needed
      // data = data.filter(function (u) {
      //   return u.email_verified && (u.user_id !== user.user_id);
      // });
  
      if (data.length > 1) {
        return callback(new Error('[!] Rule: Multiple user profiles already exist - cannot select base profile to link with'));
      }
      if (data.length === 0) {
        console.log('[-] Skipping link rule');
        return callback(null, user, context);
      }
  
      const originalUser = data[0];
      const provider = user.identities[0].provider;
      const providerUserId = user.identities[0].user_id;
  
      user.app_metadata = user.app_metadata || {};
      user.user_metadata = user.user_metadata || {};
      auth0.users.updateAppMetadata(originalUser.user_id, user.app_metadata)
      .then(auth0.users.updateUserMetadata(originalUser.user_id, user.user_metadata))
      .then(function() {
        request.post({
          url: userApiUrl + '/' + originalUser.user_id + '/identities',
          headers: {
            Authorization: 'Bearer ' + auth0.accessToken
          },
          json: { provider: provider, user_id: String(providerUserId) }
        }, function (err, response, body) {
            if (response && response.statusCode >= 400) {
              return callback(new Error('Error linking account: ' + response.statusMessage));
            }
            context.primaryUser = originalUser.user_id;
            callback(null, user, context);
        });
      })
      .catch(function (err) {
        callback(err);
      });
    });
  }

  // Check if user is accessing this rule without being redirected back
  if (context.protocol !== "redirect-callback") {

    var token = createToken(
      configuration.CLIENT_ID,
      configuration.CLIENT_SECRET,
      configuration.ISSUER, {
        sub: user.user_id,
        email: user.email
      }
    );
    context.redirect = {
      url: "https://nmmdemo.herokuapp.com/verify?token=" + token
    };
    return callback(null, user, context);

  } else {


    verifyToken(
      configuration.CLIENT_ID,
      configuration.CLIENT_SECRET,
      configuration.ISSUER,
      context.request.query.token,
      postVerify
    );


    callback(null, user, context);
  }

}