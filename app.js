require('dotenv').config()
const XeroClient = require('xero-node').AccountingAPIClient;
const config = require('./config.json');
const fs = require('fs');


var express = require("express"),
    session = require('express-session'),
    // passport = require('passport'),
    // LocalStrategy = require('passport-local'),
    bodyParser = require("body-parser"),
    // mongoose = require("mongoose"),
    AWS = require('aws-sdk'),
    dynamo = require('./dynamo'),
    twilio = require('./twilio');


// Set the region 
AWS.config.update({region: 'us-east-2'});

var app = express();
//from xero-node sample app
app.set('trust proxy', 1);
app.use(session({
    secret: 'bidi bidi bom bom',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));


//general setup
// mongoose.connect("mongodb://localhost/bill_alert");
app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(bodyParser.urlencoded({extended: true}));

let xero = new XeroClient(config);



//ROUTES

// Home Page
app.get('/', function(req, res) {
    res.render('home');
});

//XERO

app.get('/connectXero', function(req, res){
    
    (async () => {

    // Create request token and get an authorisation URL
    const requestToken = await xero.oauth1Client.getRequestToken();
    console.log('Received Request Token:', requestToken);
    
    //save to session object
    req.session.oauthRequestToken = requestToken.oauth_token;
    req.session.oauthRequestSecret = requestToken.oauth_token_secret;
    
    console.log("Here is the session:\n", req.session);

    var authUrl = xero.oauth1Client.buildAuthoriseUrl(requestToken);
    console.log('Authorisation URL:', authUrl);

    // Send the user to the Authorisation URL to authorise the connection
    res.redirect(authUrl);

    })();
});

// Redirected from xero with oauth results
app.get('/accessXero', function(req, res) {
    
    //set verifier and request token
    const oauth_verifier = req.query.oauth_verifier;
    const savedRequestToken = {
        oauth_token: req.query.oauth_token,
        oauth_token_secret: req.session.oauthRequestSecret
    };
    console.log("savedRequestToken: \n", savedRequestToken);
    
    // Once the user has authorised your app, swap Request token for Access token
    (async () => {
    
        const accessToken = await xero.oauth1Client.swapRequestTokenforAccessToken(savedRequestToken, oauth_verifier);
        console.log('Received Access Token:', accessToken);
        
        // You should now store the access token securely for the user.
        req.session.token = accessToken;
        console.log(req.session);
    
        //store access token in database
        //try adding org name to user in dynamo
        dynamo.updateUserXeroAccessToken(req.session.userPhoneNumber, accessToken).then(
          function(data) {
            console.log("Succesfully updated item: ", data.Item);
            res.redirect('/settings');
          }
        ).catch(function(error) {
            console.log(error);
            res.redirect('/');
        });

    })();
    
});

app.get('/disconnectXero', function(req, res){
   if (req.session.token) {
       //delete token
       req.session.token = "";
   } else {
       console.log("no token to delete...");
   }
   res.redirect('/settings');
});

app.get('/settings', function(req, res){
    var connectionStatus = connectedToXero(req);
    
//use to block access to settings to logged in only
    // if (req.session.userLoggedIn) {
    //     res.render('settings',
    //         {
    //             connectionStatus: connectionStatus
    //         }
    //     );
    // } else {
    //     //if you're not logged in you can't get to settings
    //     res.redirect('/');
    // }
    
    res.render('settings',
        {
            connectionStatus: connectionStatus
        }
    );
    
});

app.get('/getStarted', function(req, res) {
    
       //TODO
        //if redirected here from failed phone verify - render with note that verify failed
        //on page show message that verify failed and to try again
        
    res.render('getStarted');
    
});

//PHONE VERIFICATION

app.get('/enterVerificationCode', function(req, res) {
   res.render('enterVerificationCode'); 
});


app.post('/verifyPhoneNumber', function(req, res) {
    var theInputString = req.body.inputPhoneNumber;
    
    //clean the input string
    var userInputPhoneNumber = returnNumbersOnly(theInputString);
    console.log("Cleaned string: "+userInputPhoneNumber);
    
    //check the length
    if (userInputPhoneNumber.length !== 10) {
        console.log("Phone Number length wrong!");
        res.redirect('/getStarted');
    } else {
        //generate a verification code
        var generatedRandomCode = Math.floor(Math.random() * 10000);
        req.session.generatedRandomCode = generatedRandomCode;
        req.session.latestInputPhoneNumber = userInputPhoneNumber;
        console.log("session generatedRandomCode is: "+req.session.generatedRandomCode);
    
        //send text with code
        twilio.sendText(userInputPhoneNumber, "Your verification code is: "+req.session.generatedRandomCode);
        
        //redirect to code entry page //send code you generated -> so you can compare entry of code on following page
        res.redirect('/enterVerificationCode');
    }
    
});

app.post('/checkVerificationCode', function(req, res){
    
    //console.log("About to check this verification code: "+req.body.inputVerificationCode+" against session verification code: "+req.session.generatedRandomCode);
    
    //compare input verification code to generated one
    if (req.body.inputVerificationCode == req.session.generatedRandomCode) {
        console.log("Code correctly verified!");
        
        //store userPhoneNumber now that it's verified
        req.session.userPhoneNumber = req.session.latestInputPhoneNumber;
        
    //store new user in DB
        dynamo.createUser(req.session.userPhoneNumber).then(
          function(data) {
            /* process the data */
            console.log("Created new user with phone number: ", data.item);
            
            //setup user logged-in session
            req.session.userLoggedIn = true;
            
            //redirect to settings to finish setup and xero etc
            res.redirect('/settings');
          }
        ).catch(function(error) {
            console.log("Error creating user: \n",error);
            res.redirect('/');
        });
        
    } else {
        console.log("Code not verified. Please try again.");
        //redirect to getting started to try again
        res.redirect('/getStarted');
    }
});





app.get('/testFeature', function(req, res){
    
    //YOU'RE TRYING TO USE ACCESS TOKEN RETRIEVED FROM DB
        
        //TODO in production
        //if loggedIN
        
        //check if session has access token 
        // if (connectedToXero(req)) {
        //   //check if access token expired
        //   //if so refresh and store in session+DB
        // } 
        //else 
        //check if DB has access token
        //if yes refresh
        //if no say error you must connect to xero first
    
    
    //load access token into session for use by xero client
    dynamo.getUser('1111111116').then(
      function(data) {
        console.log("User phone number: ", data.Item);
        
        //set the AccessToken on the Xero client???
        
        const xero2 = new XeroClient(config, data.Item.xeroAccessToken);
        
        
        //try to use xero
        (async () => {
            
            const newAccessToken = await xero2.oauth1Client.refreshAccessToken();
            const xero3 = new XeroClient(config, newAccessToken);
            
            const result = await xero3.invoices.get();
            console.log('Number of invoices:', result.Invoices.length);
        })();
        
        res.redirect('/settings');
      }
    ).catch(function(error) {
        console.log(error);
        res.redirect('/');
    });
    
    
    
    
    
    // // You can make API calls straight away
    //  const result = await xero.invoices.get();
    // console.log('Number of invoices:', result.Invoices.length);
    
});

app.get('/secret', function(req, res){
   console.log("its a secret shhhh....");
   res.send("its a secret shhhh....");
});


//
//MY HELPER FUNCTIONS
//

function updateUserOrgName (req, res,phoneNumber, orgName) {
    //try adding org name to user in dynamo
    dynamo.updateUserOrgName(phoneNumber, orgName).then(
      function(data) {
        console.log("Succesfully updated item: ", data.Item);
        
        res.redirect('/settings');
      }
    ).catch(function(error) {
        console.log(error);
        res.redirect('/');
    });
}

function getUser(req, res) {
    // handle promise's fulfilled/rejected states
    dynamo.getUser('1111111116').then(
      function(data) {
        console.log("User phone number: ", data.Item);
        //TODO
        //USE THIS BLOCK TO DO SOMETHING NEXT WITH USER
        res.redirect('/');
      }
    ).catch(function(error) {
        console.log(error);
        res.redirect('/');
    });
}

function connectedToXero(req){
    if (req.session.token) {
        return true;
    } else {
        return false;
    }
}

function returnNumbersOnly(theOriginalString) {
    return theOriginalString.replace(/\D/g,'');
}






//start server
app.listen(process.env.PORT, process.env.IP, function(){
    console.log("server started homie");
});