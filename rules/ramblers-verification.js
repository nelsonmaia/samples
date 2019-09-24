function (user, context, callback) {

  const request = require('request');

  user.user_metadata = user.user_metadata ? user.user_metadata : {};
  user.app_metadata = user.app_metadata ? user.app_metadata : {};

  var membershipNumber = user.user_metadata.membership_number;
  var lastName = user.user_metadata.last_name;

  // If the application is the Progressive Profile application, we allow the user to login. 
  if ((context.protocol !== "redirect-callback" && context.clientID === "Wg2wIvNLyiry1JQlUyTKSu67vubDhgQn") || user.app_metadata.verified === true ) {
    console.log("Inside here, why?", context.protocol, context.clientID, (context.clientID === "Wg2wIvNLyiry1JQlUyTKSu67vubDhgQn" && context.protocol !== "redirect-callback"));
    context.idToken['https://ramblers.org.uk/membershipNumber'] = membershipNumber;
    context.idToken['https://ramblers.org.uk/lastName'] = lastName;
    return callback(null, user, context);
  } else {
    console.log("it is not progressive profile app");

    if (!membershipNumber || !lastName) {
      return callback(new UnauthorizedError('No membership number or last name', '2'));
    }

    var emailAddress = user.email;
    var expiryDate = user.user_metadata.expiry_date;

    // Values in the following order: MembershipNumber/EmailAddress/LastName/ExpiryDate (mmyy)
    var urlVerifyAPI = "https://pocket.ramblers.org.uk:8088/services/VerifyUser/";

    urlVerifyAPI += membershipNumber + "/" + emailAddress + "/" + lastName;
    // "4200/mlg@tinks.plus.com/Gamblin/0419"

    // If there isn't expiry date the URL is different 
    if (expiryDate != null && expiryDate != "") {
      console.log('expiry date exists');
      var mystring = expiryDate;
      mystring = mystring.replace('/', '');
      urlVerifyAPI += "/" + mystring;
    } else {
      urlVerifyAPI += "/0000";
    }
    urlVerifyAPI += "/3C62EAA1-C1C6-412E-857E-DB5B4410DB26";

    console.log("url is", urlVerifyAPI);

    request.get({
      url: urlVerifyAPI,
      headers: {
        'Authorization': 'Bearer '
      }
    },
      function (err, response, body) {

        console.log('******');
        if (err) {
          console.log('Error from Pocket Ramblers', err);
          return memberError(user, context, callback, 2);

        } else if (response.statusCode !== 200) {
          console.log("response different from 200", response.statusMessage, response.statusCode);
          return memberError(user, context, callback, 2);
        }

        try {

          const json = JSON.parse(body);

          console.log(json);
          console.log("verificationStatus", json[0].Verification_Status);
          console.log("isMember", json[0].Verification_Status["@IsCurrentMember"]);
          console.log(json[0].Verification_Status["@IsCurrentMember"] === "Y");

          if (json && json[0] && json[0].Verification_Status && json[0].Verification_Status["@IsCurrentMember"] !== "Y") {
            if (context.protocol === "redirect-callback"){
              return callback(new Error("The membership information is invalid. Please try to login again."));
            }
            return memberError(user, context, callback, json[0].Verification_Status["@Value"]);
          }

          user.app_metadata = user.user_metadata;
          user.user_metadata = {};

          user.app_metadata.verified = false;
          user.app_metadata.isMember = json[0].Verification_Status["@IsCurrentMember"];
          var hookResponse = {};
          hookResponse.user = user;
          if (user.app_metadata.verified || (json[0].Verification_Status["@IsCurrentMember"] === "Y" && json[0].Verification_Status['@Value'] === 2)) {
            user.app_metadata.verified = true;
            console.log("end of the user -----");

            auth0.users.updateAppMetadata(user.user_id, user.app_metadata)
            .then(function(){
              return callback(null, user, context);
            })
            .catch(function(err){
              return callback(err);
            });
          } else {
            console.log('The return value of @IsCurrentMember is different from Y ', user, json);

            return memberError(user, context, callback, json[0].Verification_Status['@Value']);
            //  return callback(new UnauthorizedError(json[0].Verification_Status['@Value']), hookResponse);
          }
        } catch (exception) {
          console.log('exception encountered', exception);
          return callback(new Error(exception + JSON.stringify(body)));
        }

      });
  }
  function memberError(user, context, callback, errorCode) {

  

    context.redirect = {
      url: `http://localhost:3000/profile?error_description=${errorCode}&`
    };

  

    return callback(null, user, context);
  }

}