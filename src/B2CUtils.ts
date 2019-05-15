// Adding ADAL for Policy Upload
import * as adal from 'adal-node';
import { window } from 'vscode';
import * as vscode from 'vscode';
import Consts from './Consts';
import {AuthenticationContext} from 'adal-node';

interface PolicyInfoObj {
    PolicyId: string,
    TenantId: string;
}

export default class B2CUtils {
  
    static devcodelogin(PolicyInfo: PolicyInfoObj, ClientId: string)
    {
        var authorityUrl = Consts.ADALauthURLPrefix + PolicyInfo.TenantId;
        var resource = 'https://graph.microsoft.com';

        var context = new AuthenticationContext(authorityUrl);
        context.acquireUserCode(resource, ClientId, 'es-mx', function (err, response) {
            if (err) {
                console.log('well that didn\'t work: ' + err.message);
                if( err.message = "Error login in - The clientId parameter is required.")
                {
                    vscode.window.showErrorMessage("The Graph API ClientId has not been set in Settings.");
                }
                else
                {
                    vscode.window.showErrorMessage("Error login in - " + err.message);
                }
                
                
            } else {
                console.log(response.userCode);
                var usercode = response.userCode;
                var ncp = require("copy-paste");
                ncp.copy(usercode, function () {
                // complete...
                })

                vscode.window.showErrorMessage("Please login with the following code (" + response.userCode + ")" ,"Login").then(selection => {
                
                    if(selection == "Login")
                    {                        
                        vscode.commands.executeCommand('vscode.open', vscode.Uri.parse("https://www.microsoft.com/devicelogin"));
                    }
                    else
                        return;
                  });
                 
                setTimeout(()=>{/*Your Code*/
                console.log('calling acquire token with device code');
                
                context.acquireTokenWithDeviceCode(resource, ClientId, response, function (Error, tokenResponse ) {
                    if (err) {
                        console.log('error happens when acquiring token with device code');
                        console.log(err);
                    }
                    else {
                        B2CUtils.uploadpolicy( tokenResponse as adal.TokenResponse,PolicyInfo.PolicyId);
                    }
                });
                }, 6);
            }
        });
        
    }

    static uploadPolicyRegister()
    {
            
        var PolicyInfo = B2CUtils.getPolicyInfo();
        var clientID = B2CUtils.getB2CAPIClientID();
        var authURL=Consts.ADALauthURLPrefix + PolicyInfo.TenantId; 
        var authcontext= new adal.AuthenticationContext(authURL);
        var username = "";

       
       
        authcontext.acquireToken(Consts.ADALresource,username,clientID,function(err,tokenResponse){
            if (err) {
                B2CUtils.devcodelogin(PolicyInfo, clientID);
            } else {
                // No need to auth again as we should have an access token
                B2CUtils.uploadpolicy( tokenResponse as adal.TokenResponse,PolicyInfo.PolicyId);
            }
        });
    }

    // Gets the Tenant ID and Policy ID from the Open Document
    static getPolicyInfo() : PolicyInfoObj
    {
        var DOMParser = require('xmldom').DOMParser;
        let editor = window.activeTextEditor;
        var xmldata = "";
        if (editor) {
            let doc = editor.document;
            xmldata = doc.getText();
        }

        try {
            
        var xmlDoc = new DOMParser().parseFromString(xmldata);
        var Polid = xmlDoc.getElementsByTagName("TrustFrameworkPolicy")[0].getAttribute("PolicyId")
        var tenantID = xmlDoc.getElementsByTagName("TrustFrameworkPolicy")[0].getAttribute("TenantId")
        } catch (error) {
                vscode.window.showErrorMessage("Error retrieveing PolicyId and TenantId from Policy File. Please ensure the file being uploaded is a valid B2C Policy file.");
                throw Error;
        }

        var rtnobj = {
            PolicyId: Polid ,
            TenantId: tenantID
        };

        return rtnobj;
    }


    static getB2CAPIClientID() {

        var clientID  = "";
        var config = vscode.workspace.getConfiguration('aadb2c.graph');
      
        var RtnVal = config.has("clientid");
        if (!RtnVal)
        {
            vscode.window.showErrorMessage("The ClientId setting is not set");
            return "";
        }
        else{
            clientID =  "" + config.get("clientid");
        }
        return clientID;
    }

    static async uploadpolicy(tokenResponse: adal.TokenResponse, PolicyId: string) {
        var tr = tokenResponse as adal.TokenResponse;
        var at = tr.accessToken;
        //console.log(tr.accessToken);
    
        var docContent = "";
        console.log(" upload policy");
        let editor = window.activeTextEditor;
        if (editor) {
            let doc = editor.document;
            docContent = doc.getText();
    
        }
      
        var bearertoken = "Bearer " + at;

        var options2 = {
            method: "PUT",
			url: Consts.B2CGraphEndpoint + "/" + PolicyId + "/$value",
			headers: {
                "Authorization": bearertoken,
                "Content-Type": "application/xml"
			}
        };
        var request = require('request');

        function callback(this: B2CUtils, error, response, body) {
            if (!error && response.statusCode == 200) {
                console.error("Upload success.")
                vscode.window.showInformationMessage("Upload success",)
            }
            else{
                var rspbody = response.body;
                var errmsg = JSON.parse(rspbody).error.message;
                console.error("Upload failed: " + errmsg)
                vscode.window.showErrorMessage(errmsg);
            }
        }


        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Uploading Policy (" + PolicyId + ")...",
            cancellable: false
        },
            async (progress) => {await request(options2, callback.bind(this)).write(docContent)  
        }); 
        
    }
    

}