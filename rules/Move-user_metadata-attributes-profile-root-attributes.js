function (user, context, cb) {
    // Field Mapping, the property is the root attribute and the value is the field name on user_metadata.
    // You can change the value in case you don't have the same name on user_metadata.
    var fieldMapping = {
      family_name: 'family_name',
      given_name: 'given_name',
      name: 'name',
      nickname: 'nickname',
      picture: 'picture'
    };
  
    if (needMigration(user)) {
      var ManagementClient = require('auth0@2.9.1').ManagementClient;
      var management = new ManagementClient({
        domain: auth0.domain,
        token: auth0.accessToken
      });
  
      management.updateUser(
        { id: user.user_id }, generateUserPayload(user), function (err, updatedUser) {
          if ( err ) {
            cb(err);
          } else {
            updateRuleUser(user, updatedUser);
            cb(null, user, context);
          }
        }
      );
    } else {
      cb(null, user, context);
    }
  
    function needMigration(user) {
      if (user.user_metadata) {
        for (var key in fieldMapping) {
          if (typeof user.user_metadata[fieldMapping[key]] === 'string') {
            return true;
          }
        }
      }
  
      return false;
    }
  
    function generateUserPayload(user) {
      var payload = { user_metadata: {}};
      var userMetadata = user.user_metadata;
  
      for (var key in fieldMapping) {
        generateUserPayloadField(userMetadata, payload, key, fieldMapping[key]);
      }
  
      return payload;
    }
  
    function updateRuleUser(user, updatedUser) {
      for (var key in fieldMapping) {
        if (typeof user.user_metadata[fieldMapping[key]] === 'string') {
          user[key] = updatedUser[key];
          delete user.user_metadata[fieldMapping[key]];
        }
      }
    }
  
    function generateUserPayloadField(userMetadata, payload, rootField, metadataField) {
      if (typeof userMetadata[metadataField] === 'string') {
        payload[rootField] = userMetadata[metadataField];
        payload.user_metadata[metadataField] = null;
      }
    }
  }