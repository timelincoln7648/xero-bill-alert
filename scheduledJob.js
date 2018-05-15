var twilio = require('./twilio'),
    dynamo = require('./dynamo'),
    schedule = require('node-schedule'),
    dateFormat = require('dateformat'),
    currency = require('currency-formatter');



module.exports = {
  
    start: function () {
        
        // run at 8:30am every day on deployed machine's clock
        var dailyJob = schedule.scheduleJob('30 8 * * *', function() {
            const today = Date.now();
            console.log("Scheduled Daily Job Fired");
            
            (async () => {
            
                await dynamo.getAllXeroConnectedUsers().then(
                  function(data) {
                    // console.log("Here are the items retrieved from the scan:\n", data);
                    
                    data.Items.forEach(function(item) {
                        
                        (async () => {
                            await dynamo.getUser(item.phoneNumber).then(
                                function(user) {
                                    console.log("\n"+user.Item.orgName+" has the following unpaid bills: ");
                                    user.Item.invoices.forEach(function(invoice){
                                        const dueDate = Date.parse(invoice.DueDateString);
                                        const dateDiffInDays = Math.abs((today - dueDate)/(1000 * 60 * 60 * 24));     //divide by milliseconds in a day
                                        
                                        //if bill has an amount due and is due +/- 3 days from today, send a text about it
                                        if ((invoice.AmountDue > 0) && (dateDiffInDays < 3)) {
                                            var text = makeTextMessageString(user.Item.orgName, user.Item.orgShortCode, invoice.InvoiceID, invoice.AmountDue, dueDate);
                                            twilio.sendText(item.phoneNumber, text);
                                        }
                                    });
                                }
                            ).catch(function(error) {
                                console.log("Error finding user: ", error);
                            });
                        
                        })();
                        
                    });
                    
                  }
                ).catch(function(error) {
                    console.log("Error running scan: ", error);
                });
            
            })();
            
        });
      
    },
    
};

function makeTextMessageString(orgName, orgShortCode, invoiceID, amount, dueDate) {
    var deepLink = "https://go.xero.com/organisationlogin/default.aspx?shortcode="+orgShortCode+"&redirecturl=/AccountsPayable/Edit.aspx?InvoiceID="+invoiceID;
    var textString = orgName+" has a bill for "+currency.format(amount, { code: 'USD' })+", due on "+dateFormat(dueDate, "longDate")+".";
    textString += "\n\nClick below to view and pay this bill in Xero. \n";
    textString += deepLink;
    
    return textString;
}

function getUser (phoneNumber) {
    dynamo.getUser(phoneNumber).then(
          function(data) {
            console.log("got user here's the details:\n", data.Item.orgName);
          }
        ).catch(function(error) {
            console.log(error);
        });
}
