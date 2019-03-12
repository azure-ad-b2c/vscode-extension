import * as vscode from 'vscode';
import fs = require('fs');
import path = require('path');
import Consts from './Consts';
export default class PolicBuild {
    static Build() {


        var rootPath: string;
        // Check if a folder is opend
        if ((!vscode.workspace.workspaceFolders) || (vscode.workspace.workspaceFolders.length == 0)) {
            vscode.window.showWarningMessage("To build a policy you need to open the policy folder in VS code");
            return;
        }

        rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
        var filePath = path.join(rootPath, "appsettings.json");

        // Check if appsettings.json is existed under for root folder
        vscode.workspace.findFiles(new vscode.RelativePattern(vscode.workspace.rootPath as string, 'appsettings.json'))
            .then((uris) => {

                if (!uris || uris.length == 0) {
                    vscode.window.showQuickPick(["Yes", "No"], { placeHolder: 'The appsettings.json file is missing, do you want to create?' })
                        .then(result => {
                            if (!result || result === "No")
                                return;

                            // Create app settings file with default values
                            fs.writeFile(filePath, Consts.DefaultDeploymentSettings, 'utf8', (err) => {
                                if (err) throw err;

                                vscode.workspace.openTextDocument(filePath).then(doc => {
                                    vscode.window.showTextDocument(doc);
                                });
                            });
                        });
                }
                else {

                    // Read all policy files from the root directory
                    vscode.workspace.findFiles(new vscode.RelativePattern(vscode.workspace.rootPath as string, '*.{xml}'))
                        .then((uris) => {
                            let policyFiles: PolicyFile[] = [];
                            uris.forEach((uri) => {
                                if (uri.fsPath.indexOf("?") <= 0) {
                                    var data = fs.readFileSync(uri.fsPath, 'utf8');
                                    policyFiles.push(new PolicyFile(path.basename(uri.fsPath), data.toString()))
                                }
                            });

                            return policyFiles;
                        }).then((policyFiles) => {

                            // Get the app settings
                            vscode.workspace.openTextDocument(filePath).then(doc => {
                                var appSettings = JSON.parse(doc.getText());
                                var environmentsRootPath = path.join(rootPath, "Environments");

                                // Ensure environments folder exists
                                if (!fs.existsSync(environmentsRootPath)) {
                                    fs.mkdirSync(environmentsRootPath);
                                }

                                // Iterate through environments  
                                appSettings.Environments.forEach(function (entry) {

                                    if (entry.PolicySettings == null) {
                                        vscode.window.showErrorMessage("Can't generate '" + entry.Name + "' environment policies. Error: Accepted PolicySettings element is missing. You may use old version of the appSettings.json file. For more information, see [App Settings](https://github.com/yoelhor/aad-b2c-vs-code-extension/blob/master/README.md#app-settings)");
                                    }
                                    else {
                                        var environmentRootPath = path.join(environmentsRootPath, entry.Name);

                                        // Ensure environment folder exists
                                        if (!fs.existsSync(environmentRootPath)) {
                                            fs.mkdirSync(environmentRootPath);
                                        }

                                        // Iterate through the list of settings
                                        policyFiles.forEach(function (file) {

                                            var policContent = file.Data;

                                            // Replace the tenant name
                                            policContent = policContent.replace(new RegExp("\{Settings:Tenant" + "\}", "g"), entry.Tenant);

                                            // Replace the rest of the policy settings
                                            Object.keys(entry.PolicySettings).forEach(key => {
                                                policContent = policContent.replace(new RegExp("\{Settings:" + key + "\}", "g"), entry.PolicySettings[key]);
                                            });

                                            // Save the  policy
                                            fs.writeFile(path.join(environmentRootPath, file.FileName), policContent, 'utf8', (err) => {
                                                if (err) throw err;
                                            });
                                        });

                                        vscode.window.showInformationMessage("You policies successfully exported and stored under the Environment folder.");
                                    }
                                });

                            });
                        });
                }

            });
    };

    static GetAllSettings(): string[] {

        var items: string[] = [];

        var rootPath: string;
        // Check if a folder is opend
        if ((!vscode.workspace.workspaceFolders) || (vscode.workspace.workspaceFolders.length == 0)) {
            return items;
        }

        // Get the app settings file path
        rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
        var filePath = path.join(rootPath, "appsettings.json");

        // Check if file exists
        if (fs.existsSync(filePath)) {
            var fileContent = fs.readFileSync(filePath, "utf8");
            var appSettings = JSON.parse(fileContent);

            // Add the items from each environment
            items.push('{Settings:Tenant}');

            appSettings.Environments.forEach(function (entry) {

                // Replace the rest of the policy settings
                Object.keys(entry.PolicySettings).forEach(key => {

                    if (items.indexOf('{Settings:' + key + '}') == (-1)) {
                        items.push('{Settings:' + key + '}');
                    }
                });
            });
        }

        return items;
    }
}

export class PolicyFile {
    public FileName: string;
    public Data: string;

    constructor(fileName: string, data: string) {
        this.FileName = fileName;
        this.Data = data;
    }
}