import * as adal from 'adal-node';
import fs = require('fs');
import * as vscode from 'vscode';
import Consts from './Consts';
import path = require('path');
import {AuthenticationContext} from 'adal-node';
import PolicyUpload from './PolicyUpload';

export default class B2CArtifacts {

    static GetB2CArtifacts() {
        var rootPath: string;
        // Check if a folder is opend
        if ((!vscode.workspace.workspaceFolders) || (vscode.workspace.workspaceFolders.length == 0)) {
            vscode.window.showWarningMessage("To build a policy you need to open the policy folder in VS code");
            return;
        }

        rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
        var filePath = path.join(rootPath, "appsettings.json");

        // Check if appsettings.json exists under for root folder
        vscode.workspace.findFiles(new vscode.RelativePattern(vscode.workspace.rootPath as string, 'appsettings.json'))
            .then((uris) => {

                if (!uris || uris.length == 0) {
                    vscode.window.showErrorMessage('You must create and populate appSettings file with your B2C tenant name');
                    return;
                }
                else {
                    vscode.workspace.openTextDocument(filePath)
                    .then(async doc => {
                        let appSettings = JSON.parse(doc.getText());
                        for(let entry of appSettings.Environments) {
                            if (entry.PolicySettings == null)
                                vscode.window.showErrorMessage("Can't process '" + entry.Name + "' environment policies. Error: Accepted PolicySettings element is missing. You may use old version of the appSettings.json file. For more information, see [App Settings](https://github.com/yoelhor/aad-b2c-vs-code-extension/blob/master/README.md#app-settings)");
                            else
                                await getTenantArtifacts(entry);
                        };
                        let docOut = JSON.stringify(appSettings);
                        fs.writeFile(filePath, Consts.DefaultDeploymentSettings, 'utf8', (err) => {
                            if (err) throw err;
                            vscode.workspace.openTextDocument(filePath).then(d => {
                                vscode.window.showTextDocument(d).then(e => {
                                    e.edit(async edit => {
                                        edit.delete(new vscode.Range(new vscode.Position(0,0) ,new vscode.Position(9999,0)));
                                        edit.insert(new vscode.Position(0,0), docOut);
                                        await vscode.commands.executeCommand('editor.action.formatDocument');
                                    })
                                });
                            }); 
                        });                           
                    });                   
                }
            });

        function getTenantArtifacts(entry: any): Promise<any> {
            return new Promise((resolve, reject) => {
                let tenantId = entry.Tenant;
                getToken(tenantId)
                .then((at) => {
                    getAppByName(tenantId, "ProxyIdentityExperienceFramework", at)
                    .then((app) => {
                        entry.PolicySettings.ProxyIdentityExperienceFrameworkAppId = app.appId;
                    }).catch(() => resolve()) // skip if not found
                    .then(() => {
                        getAppByName(tenantId, "IdentityExperienceFramework", at)
                        .then((app) => {
                            entry.PolicySettings.IdentityExperienceFrameworkAppId = app.appId;
                        }).catch(() => resolve()) // skip if not found
                    })
                    .then(() => {
                        getAppByName(tenantId, "b2c-extensions-app.", at)
                        .then((app) => {
                            entry.PolicySettings.AADExtensionsAppId = app.appId;
                            entry.PolicySettings.AADExtensionsObjectId = app.id;                                                
                            resolve();
                        }).catch(() => resolve()) // skip if not found
                    })                   
                })
            });
        }

        function getToken(tenantId: string): Promise<string> {
            var clientId = PolicyUpload.getMSGraphClientID();
            var authorityUrl = Consts.ADALauthURLPrefix + tenantId;
            var resource = 'https://graph.microsoft.com';
            var context = new AuthenticationContext(authorityUrl);
            let username = "";            
            return new Promise((resolve, reject) => {
                context.acquireToken(resource,username,clientId,function(err,tokenResponse){
                    if (err) {
                        deviceLogin(tenantId)
                            .then((a) => resolve(a))
                            .catch((err) => reject(err));
                    } else {
                        var tk = tokenResponse as adal.TokenResponse;
                        resolve(tk.accessToken);
                    }
                });
            })
        }

        function getAppByName(tenantId: string, appName: string, accessToken: string): Promise<any> {
            return new Promise((resolve, reject) => {
                console.log("getting B2C tenant data ");
                var request = require('request');
                // using startsWith because b2c extension app name is very long! being lazy
                let options = {
                    url: `https://graph.microsoft.com/beta/applications?$filter=startsWith(displayName,'${appName}')`,
                    headers: {
                        "Authorization": `Bearer ${accessToken}`
                    }
                };
            
                request(options, (err, res, body) => {
                    if (err) {
                        vscode.window.showErrorMessage(err);
                        reject(err);
                    } else {
                        let apps = JSON.parse(body);   
                        if (apps.value.length == 0)
                        {
                            vscode.window.showErrorMessage(`${appName} not found in ${tenantId}`);
                            reject('app not found');
                        }
                        resolve(apps.value[0]);
                    }
                });
            });
        }

        function deviceLogin(tenantId: string): Promise<string> {
            return new Promise((resolve, reject) => {
                var clientId = PolicyUpload.getMSGraphClientID();
                var authorityUrl = Consts.ADALauthURLPrefix + tenantId;
                var resource = 'https://graph.microsoft.com';
                var context = new AuthenticationContext(authorityUrl);
                context.acquireUserCode(resource, clientId, 'es-mx', function (err, response) {
                    if (err) {
                        console.log('well that didn\'t work: ' + err.message);
                        if( err.message = "Error login in - The clientId parameter is required.") {
                            vscode.window.showErrorMessage("The Graph API ClientId has not been set in Settings.");
                        }
                        else {
                            vscode.window.showErrorMessage("Error login in - " + err.message);
                        }
                        reject(err);
                    } else {
                        console.log(response.userCode);
                        var usercode = response.userCode;
                        var ncp = require("copy-paste");
                        ncp.copy(usercode, function () {
                            vscode.window.showErrorMessage(`Please login to ${tenantId} with the following code (${response.userCode})` ,"Login")
                            .then(selection => {
                                if(selection == "Login") {
                                    console.log('starting login');
                                    vscode.commands.executeCommand('vscode.open', vscode.Uri.parse("https://www.microsoft.com/devicelogin"))
                                    .then(() => {
                                        setTimeout(()=> {
                                            console.log('calling acquire token with device code');
                                            context.acquireTokenWithDeviceCode(resource, clientId, response, function (Error, tokenResponse ) {
                                                if (err) {
                                                    console.log('error happens when acquiring token with device code');
                                                    console.log(err);
                                                    vscode.window.showErrorMessage('An error happens when acquiring token with device code');
                                                    reject(err);
                                                }
                                                else {
                                                    console.log('got access token');
                                                    let tr = tokenResponse as adal.TokenResponse;
                                                    resolve(tr.accessToken);
                                                }
                                            });
                                        }, 6);
                                    });
                                } else
                                    reject("login rejected");
                            });
                        });
                    }
                });
            });
        }
    }
}
