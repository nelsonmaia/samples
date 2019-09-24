function (user, context, callback) {
  /**
   * This rule has been automatically generated by
   * Unknown - Auth0 -  at 2019-09-13T08:22:55.754Z
   */
  var request = require('request@2.56.0');
  var queryString = require('querystring');
  var Promise = require('native-or-bluebird@1.2.0');
  var jwt = require('jsonwebtoken@7.1.9');
  var CONTINUE_PROTOCOL = 'redirect-callback';
  var LOG_TAG = '[OTP-VERIFICATION]: ';
  console.log(LOG_TAG, 'Entered Account Link Rule');
  // 'query' can be undefined when using '/oauth/token' to log in
  context.request.query = context.request.query || {};
  var config = {
    endpoints: {
      linking: 'https://nmm.us8.webtask.io/auth0-otp-verification-extension',
      userApi: auth0.baseUrl + '/users',
      usersByEmailApi: auth0.baseUrl + '/users'
    },
    token: {
      clientId: '85E336T4iyYvRraxPdPda7eEYWYl8xe0',
      clientSecret: 'YcZu7hcxRwWDMmJap8G7QbFXn7Whp_Lmql9RYeGcMjMh5HvYIA1F6YzbQvkLMck7',
      issuer: auth0.domain
    }
  };
 
  createStrategy().then(callbackWithSuccess).catch(callbackWithFailure);

  function createStrategy() {

    if(context.connection === "sms" && !shouldLink() ){
      return callback(new Error("Login not supported for SMS"));
    }

    if (shouldLink()) { 
      return linkAccounts();
    } else if (shouldPrompt()) {
      return promptUser();

    }

    return continueAuth();

    function shouldLink() {
       console.log(LOG_TAG, 'Should Link', !!context.request.query.link_account_token);
       console.log(LOG_TAG, context.request.query.link_account_token );
      return !!context.request.query.link_account_token;
    }

    function shouldPrompt() {
      
      console.log(LOG_TAG, '!insideRedirect()', !insideRedirect());
      console.log(LOG_TAG, '!redirectingToContinue()', !redirectingToContinue());
      
      
      var should = !insideRedirect() && !redirectingToContinue() ;//&& firstLogin();
       console.log(LOG_TAG, 'Should Prompt', should);
      
      return should;

      // Check if we're inside a redirect
      // in order to avoid a redirect loop
      // TODO: May no longer be necessary
      function insideRedirect() {
        return context.request.query.redirect_uri &&
          context.request.query.redirect_uri.indexOf(config.endpoints.linking) !== -1;
      }

      // Check if this is the first login of the user
      // since merging already active accounts can be a
      // destructive action
      function firstLogin() {
        return context.stats.loginsCount <= 1;
      }

      // Check if we're coming back from a redirect
      // in order to avoid a redirect loop. User will
      // be sent to /continue at this point. We need
      // to assign them to their primary user if so.
      function redirectingToContinue() {
        return context.protocol === CONTINUE_PROTOCOL;
      }
    }
  }

  function verifyToken(token, secret) {
    return new Promise(function(resolve, reject) {
      jwt.verify(token, secret, function(err, decoded) {
        if (err) {
          return reject(err);
        }

        return resolve(decoded);
      });
    });
  }

  function linkAccounts() {
    var secondAccountToken = context.request.query.link_account_token;

    console.log("Second account to be link", secondAccountToken);

    return verifyToken(secondAccountToken, config.token.clientSecret)
      .then(function(decodedToken) {
       
        // TODO verification on the backend that phone number matches from original and current account

        var linkUri = config.endpoints.userApi+'/'+decodedToken.sub+'/identities';
        var headers = {
          Authorization: 'Bearer ' + auth0.accessToken,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        };

        var newApp_metadata = decodedToken.app_metadata || {};
             newApp_metadata.isVerified = true;

            //  auth0.users.updateAppMetadata(decodedToken.sub, newApp_metadata).then(() =>{
            //   context.primaryUser = decodedToken.sub;
            //   return _;
  
            //  });

            var ManagementClient = require('auth0@2.9.1').ManagementClient;
              var management = new ManagementClient({
                domain: auth0.domain,
                token: auth0.accessToken
              });

              var userPayload = {
                //   phone_number: user.phone_number,
                   app_metadata: newApp_metadata
                 };
   


        return apiCall({
          method: 'GET',
          //url: config.endpoints.userApi+'/'+decodedToken.sub+'?fields=identities',
          url: config.endpoints.userApi+'/'+user.user_id+'?fields=identities',
          headers: headers
        })
          .then(function(secondaryUser) {
            var provider = secondaryUser &&
              secondaryUser.identities &&
              secondaryUser.identities[0] &&
              secondaryUser.identities[0].provider;

            return apiCall({
              method: 'POST',
              url: linkUri,
              headers,
              json: { user_id: user.user_id, provider: provider }
            });
          })
          .then(
             
              management.updateUser({ id: decodedToken.sub }, userPayload, function (err, user) {
                if (err) {
                  console.log("err", err);
                 throw err;
                }
              
                // Updated user.
                console.log(user);
                context.primaryUser = decodedToken.sub;
                return _;
              })


            
          ).catch(err => {
            throw err;
          });
      });
  }

  function continueAuth() {
    return Promise.resolve();
  }

  function isVerifiedUser(){
    console.log("Is verified user", user.app_metadata);
    if(!user.app_metadata || user.app_metadata.isVerified !== true){
      return false;
    }
    return true;
  }

  function promptUser() {

    if(isVerifiedUser()){
      console.log("Is verified");
      return Promise.resolve();
    }    

    return searchUsersWithSamePhone().then(function transformUsers(users) {

      return users.filter(function(u) {
        return u.user_id !== user.user_id;
      }).map(function(user) {
        return {
          userId: user.user_id,
          email: user.email,
          picture: user.picture,
          connections: user.identities.map(function(identity) {
            return identity.connection;
          })
        };
      });
    }).then(function redirectToExtension(targetUsers) {
      console.log("target users before function", targetUsers);
      console.log("context.query", context.request.query);
      console.log("target users", targetUsers);
     // if (targetUsers.length > 0) {
        context.redirect = {
          // url: buildRedirectUrl(createToken(config.token), targetUsers)
           url: buildRedirectUrl(createToken(config.token), context.request.query)
        };
     // }
    });
  }

  function callbackWithSuccess(_) {
     console.log(LOG_TAG, 'Callback With Success');
    callback(null, user, context);

    return _;
  }

  function callbackWithFailure(err) {
     console.log(LOG_TAG, 'Callback with failure');
    console.error(LOG_TAG, err.message, err.stack);

    callback(err, user, context);
  }

  function createToken(tokenInfo, targetUsers) {

    console.log("tokenInfo", tokenInfo);
    var options = {
      expiresIn: '5m',
      audience: tokenInfo.clientId,
      issuer: qualifyDomain(tokenInfo.issuer)
    };

    console.log("target users", targetUsers);

    var userSub = {
      sub: user.user_id,
      email: user.email,
      base: auth0.baseUrl,
      phone_number : user.phone_number
    };

    console.log("user sub", userSub);

    return jwt.sign(userSub, tokenInfo.clientSecret, options);
  }

  function searchUsersWithSamePhone() {
    var phoneNumberSearch = 'phone_number:"'+user.phone_number+'"';
    return apiCall({
      method: 'GET',
      url: config.endpoints.usersByEmailApi,
      qs: {q: phoneNumberSearch, search_engine: 'v3'}
    });
  }

  // Consider moving this logic out of the rule and into the extension
  function buildRedirectUrl(token, q, errorType) {
    
    console.log("Build Redirect URL", q.original_state);
    
    var params = {
      child_token: token,
      audience: q.audience,
      client_id: q.client_id,
      redirect_uri: q.redirect_uri,
      scope: q.scope,
      response_type: q.response_type,
      auth0Client: q.auth0Client,
      original_state: q.original_state || q.state,
      nonce: q.nonce,
      error_type: errorType
    };

    return config.endpoints.linking + '?' + queryString.encode(params);
  }

  function qualifyDomain(domain) {
    return 'https://'+domain+'/';
  }

  function apiCall(options) {
    return new Promise(function(resolve, reject) {
      var reqOptions = Object.assign({
        url: options.url,
        headers: {
          Authorization: 'Bearer ' + auth0.accessToken,
          Accept: 'application/json'
        },
        json: true
      }, options);

      request(reqOptions, function handleResponse(err, response, body) {
        if (err) {
          reject(err);
        } else if (response.statusCode < 200 || response.statusCode >= 300) {
          console.error(LOG_TAG, 'API call failed: ', body);
          reject(new Error(body));
        } else {
          resolve(response.body);
        }
      });
    });
  }
}