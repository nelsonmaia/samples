function (user, context, callback) {
    // Require the Node.js packages that we are going to use.
    // Check this website for a complete list of the packages available:
    // https://auth0-extensions.github.io/canirequire/
    var rp = require('request-promise');
    var uuidv4 = require('uuid');
  
    // The name of your Active Directory connection (if using one)
    var AUTH0_AD_CONNECTION = 'FabrikamAD';
    // The client_id of your Office 365 SSO integration
    // You can get it from the URL when editing the SSO integration,
    // it will look like
    // https://manage.auth0.com/#/externalapps/{the_client_id}/settings
    var AUTH0_OFFICE365_CLIENT_ID = "rsN74GgoZs0317d0KH8NSj7r52NR8f6y";
    // The main domain of our company.
    var YOUR_COMPANY_DOMAIN = 'nmma0.com';
    // Your Azure AD domain.
    var AAD_DOMAIN = "nmma0.com";
    // The Application ID generated while creating the Azure AD app.
    var AAD_APPLICATION_ID = "751b0d15-9181-4a53-9654-7a8e1337e11a";
    // The generated API key for the Azure AD app.
    var AAD_APPLICATION_API_KEY = "Fi4n_EXb@OB?y85+1]:buYnZQ.cdVIow";
    // The location of the users that are going to access Microsoft products.
    var AAD_USAGE_LOCATION = 'GB';
    // Azure AD doesn't recognize the user instantly, it needs a few seconds
    var AAD_USER_CREATE_DELAY = 15000;
    // The key that represents the license that we want to give the new user.
    // Take a look in the following URL for a list of the existing licenses:
    // https://gist.github.com/Lillecarl/3c4727e6dcd1334467e0
    var OFFICE365_KEY = 'SHAREPOINTSTANDARD';
  
    // Only execute this rule for the Office 365 SSO integration.
    if (context.clientID !== AUTH0_OFFICE365_CLIENT_ID) {
      return callback(null, user, context);
    }
  
    // Skip custom provisioning for AD users.
    if (context.connection === AUTH0_AD_CONNECTION) {
      return callback(null, user, context);
    }
  
    // If the user is already provisioned on Microsoft AD, we skip
    // the rest of this rule
    user.app_metadata = user.app_metadata || {};
    if (user.app_metadata.office365Provisioned) {
      return connectWithUser();
    }
  
    // Global variables that we will use in the different steps while
    // provisioning a new user.
    var token;
    var userPrincipalName;
    var mailNickname = user.email.split('@')[0];
    var uuid = uuidv4.v4();
    var immutableId = new Buffer(uuid).toString('base64');
    var userId;
  
    // All the steps performed to provision new Microsoft AD users.
    // The definition of each function are below.
    getAzureADToken()
      .then(createAzureADUser)
      .then(getAvailableLicenses)
      .then(assignOffice365License)
      .then(saveUserMetadata)
      .then(waitCreateDelay)
      .then(connectWithUser)
      .catch(errorHandling);
  
  
      function errorHandling(response){
  
          // console.log("callback is", response);
  
  console.log("object", response.error.message );
  console.log("errpr object", response.error );
  
  
          return callback();
      }
  
    // Requests an Access Token to interact with Windows Graph API.
    function getAzureADToken() {
      var options = {
        method: 'POST',
        url: 'https://login.windows.net/' + AAD_DOMAIN + '/oauth2/token?api-version=1.5',
        headers: {
          'Content-type': 'application/json',
          },
        json: true,
        form: {
          client_id: AAD_APPLICATION_ID,
          client_secret: AAD_APPLICATION_API_KEY,
          grant_type: 'client_credentials',
          resource: 'https://graph.windows.net'
        },
      };
  
  
      return rp(options);
    }
  
    // Gets the Access Token requested above and assembles a new request
    // to provision the new Microsoft AD user.
    function createAzureADUser(response) {
      token = response.access_token;
      userPrincipalName = 'auth0-' + uuid + '@' + YOUR_COMPANY_DOMAIN;
  
      console.log("create azure",token);
  
      var options = {
        url: 'https://graph.windows.net/' + AAD_DOMAIN + '/users?api-version=1.6',
        headers: {
          'Content-type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        json: true,
        body: {
          accountEnabled: true,
          displayName: user.nickname,
          mailNickname: mailNickname,
          userPrincipalName: userPrincipalName,
          passwordProfile: {
            password: immutableId,
            forceChangePasswordNextLogin: false
          },
          immutableId: immutableId,
          usageLocation: AAD_USAGE_LOCATION
        },
      };
  
      return rp(options);
    }
  
    // After provisioning the user, we issue a request to get the list
    // of available Microsoft products licenses.
    function getAvailableLicenses(response) {
      userId = response.objectId;
  
    //  console.log("response is",response);
      var options = {
        url: 'https://graph.windows.net/' + AAD_DOMAIN + '/subscribedSkus?api-version=1.6',
        json: true,
        headers: {
          'Content-type': 'application/json',
          'Authorization': 'Bearer ' + token
        }
      };
      return rp(options);
    }
  
    // With the licenses list, we iterate over it to get the id (skuId) of the
    // license that we want to give to the new user (office 365 in this case).
    // We also issue a new request to the Graph API to tie the user and the
    // license together.
    function assignOffice365License(response) {
      var office365License;
  
      console.log("valid licence", response);
  
      for (var i = 0; i < response.value.length; i++) {
        if (response.value[i].skuPartNumber === OFFICE365_KEY) {
          office365License = response.value[i].skuId;
          break;
        }
      }
  
      var options = {
        url: ' https://graph.windows.net/' + AAD_DOMAIN + '/users/' + userId + '/assignLicense?api-version=1.6',
        headers: {
          'Content-type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        json: true,
        body: {
          'addLicenses': [
            {
              'disabledPlans': [],
              'skuId': office365License
            }
          ],
          'removeLicenses': []
        }
      };
      return rp(options);
    }
  
    // After provisioning the user and giving a license to them, we record
    // (on Auth) that this G Suite user has already been provisioned. We
    // also record the user's principal username and immutableId to properly
    // redirect them on future logins.
    function saveUserMetadata() {
      user.app_metadata = user.app_metadata || {};
  
      user.app_metadata.office365Provisioned = true;
      user.app_metadata.office365UPN = userPrincipalName;
      user.app_metadata.office365ImmutableId = immutableId;
  
      return auth0.users.updateAppMetadata(user.user_id, user.app_metadata);
    }
  
    // As mentioned, Windows Graph API needs around 10 seconds to finish
    // provisioning new users (even though it returns ok straight away)
    function waitCreateDelay() {
      return new Promise(function (resolve) {
        setTimeout(function() {
          resolve();
        }, AAD_USER_CREATE_DELAY);
      });
    }
  
    // Adds the principal username and immutableId to the user object and ends
    // the rule.
    function connectWithUser() {
      user.upn = user.app_metadata.office365UPN;
      user.inmutableid = user.app_metadata.office365ImmutableId;
        return callback(null, user, context);
    }
  }