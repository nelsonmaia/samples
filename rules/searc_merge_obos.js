function mergeUsersByPersonID(user, context, callback) {

  const fetch = require("isomorphic-fetch@2.2.0");
  const { omit } = require("lodash");

  // AUth0 Management API Client
  const ManagementClient = require('auth0@2.9.1').ManagementClient;

  // Auth0 Users Management API URL
  const userApiUrl = auth0.baseUrl + "/users";


  // Check if the person id has changed from last authorize. For new users, it will be always true
  const personIdChanged =
    context.old_obos_metadata && 
    user.app_metadata.obos &&
    context.old_obos_metadata.personId !== user.app_metadata.obos.personId;

  // If the person id hasn't changed, it is not a new user and doesn't need merge
  if (!personIdChanged) {
    callback(null, user, context);
    return;
  }

  // Query users with the same person id
  const query = encodeURIComponent(
    `app_metadata.obos.personId:"${user.app_metadata.obos.personId}" AND NOT user_id:"${user.user_id}"`
  );

  const userApiOptions = {
    headers: {
      Authorization: "Bearer " + auth0.accessToken
    }
  };
  

  fetch(`${userApiUrl}?q=${query}`, userApiOptions)
    .then(response => {
      if (response.status !== 200) {
        throw new Error(`Error code ${response.status}`);
      }
      return response.json();
    })
    .then(body => {
      
        // Make sure the current users is not in the list
      const users = body.filter(u => u.user_id !== user.user_id);

      if (users.length === 0) {
        console.log("No users to merge");
        return callback(null, user, context);
      }

      // Ignoring situations for return of more then 1 user
      const originalUser = users[0];

      // Keep the obos metadata from the previous user
      const newAppMetadata = {
        ...omit(originalUser.app_metadata, "obos"),
        obos: user.app_metadata.obos
      };

      // Update the user metadata with the new and previous information merged
      auth0.users
        .updateAppMetadata(user.user_id, newAppMetadata)
        .then(function() {
            
            const management = new ManagementClient({
              domain: auth0.domain,
              clientId: "JJfkApW3boaDx7w1BkRwvwCHOCq11YtZ",
              clientSecret: "YfC7BXehX-kgbF8k39j_QXqq2K2p4naofMpH28F3VqAoIjBms2VKLoArvf-pxS5S",
              scopes: "delete:users"
            });
          
            // Delete the original SMS account since the number has changed
            management.deleteUser({ id: originalUser.user_id },function (err) {
              console.log(err);
              callback(null, user, context);
            });
        })
        .catch(function(err) {
          callback(err);
        });
    })
    .catch(err => {
      return callback(err);
    });
}
