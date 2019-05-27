function (user, context, callback) {

  function createToken(clientId, clientSecret, issuer, user) {

    console.log("it is here", clientId, clientSecret, issuer, user);

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

      return callback(null, user, context);
    }
  }

  // Check if user is accessing this rule without being redirected back
  if (context.protocol !== "redirect-callback") {

    var token = createToken(
      "clientId",
      "secret123",
      "nmmdemo", {
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
      "clientId",
      "secret123",
      "nmmdemo",
      context.request.query.token,
      postVerify
    );


    callback(null, user, context);
  }

}