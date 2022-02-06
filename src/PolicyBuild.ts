import * as vscode from 'vscode';
import fs = require('fs');
import path = require('path');
import Consts from './Consts';
import RenumberStepsMultiplePolicies from './RenumberStepsMultiplePolicies';

export default class PolicBuild {
    static Build({singlePolicy = false} = {}) {

        var policyFilter: string = "**/*.{xml}";
        var targetPolicy: string = "";
        if (singlePolicy) {
            var editor: vscode.TextEditor = vscode.window.activeTextEditor as vscode.TextEditor;

            if (!editor) {
                vscode.window.showErrorMessage("No policy is open");
                return;
            }

            if (path.extname(editor.document.fileName) !== ".xml") {
                vscode.window.showErrorMessage("The currently open file is not an XML document");
                return;
            }

            targetPolicy = path.basename(editor.document.fileName);
            policyFilter = "**/" + targetPolicy;
        }

        var rootPath: string;
        var hasBuiltAnyPolicies = false;

        // Check if a folder is opened
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

                    var appSettings = JSON.parse(fs.readFileSync(filePath, 'utf8'));

                    // Read all policy files from the root directory

                    var environmentFolder;

                    if (appSettings.EnvironmentsFolder == null) {
                        environmentFolder = "Environments";
                    } else {
                        environmentFolder = appSettings.EnvironmentsFolder;
                    }

                    // Give users an indication that we're still doing work
                    vscode.window.withProgress(
                        {location: vscode.ProgressLocation.Window, cancellable: false, title: "Policy build status"},
                        async (progress) => {
                            progress.report({message: "Building policies"});

                            // Converted to await because the progress report doesn't work properly otherwise
                            var uris = await vscode.workspace.findFiles(new vscode.RelativePattern(vscode.workspace.rootPath as string, policyFilter), `**/${environmentFolder}/**`);
                            
                            let policyFiles: PolicyFile[] = [];
                            uris.forEach((uri) => {
                                if (uri.fsPath.indexOf("?") <= 0) {
                                    var data = fs.readFileSync(uri.fsPath, 'utf8');
                                    policyFiles.push(new PolicyFile(uri.fsPath, data.toString()));
                                }
                            });

                            // Automatically renumber orchestration steps if they are out of order
                            let config = vscode.workspace.getConfiguration('aadb2c');
                            if (config.autoRenumber) {
                                progress.report({message: "Renumbering policies"});
                                RenumberStepsMultiplePolicies.RenumberPolicies(policyFiles);
                            }

                            // Get the app settings
                            var doc = await vscode.workspace.openTextDocument(filePath);
                            var appSettings = JSON.parse(doc.getText());
                            var environmentsRootPath = path.join(rootPath, environmentFolder);

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
                                        policContent = policContent.replace(new RegExp("\{Settings:Tenant\}", "gi"), entry.Tenant);

                                        // Replace the file name
                                        policContent = policContent.replace(new RegExp("\{Settings:Filename\}", "gi"), file.FileName.replace(/\.[^/.]+$/, ""));

                                        // Replace the file name and remove the policy prefix
                                        policContent = policContent.replace(new RegExp("\{Settings:PolicyFilename\}", "gi"), file.FileName.replace(/\.[^/.]+$/, "").replace(new RegExp("B2C_1A_", "g"), ""),);

                                        // Replace the environment name
                                        policContent = policContent.replace(new RegExp("\{Settings:Environment\}", "gi"), entry.Name);

                                        // Replace the rest of the policy settings
                                        Object.keys(entry.PolicySettings).forEach(key => {
                                            policContent = policContent.replace(new RegExp("\{Settings:" + key + "\}", "gi"), entry.PolicySettings[key]);
                                        });

                                        // Check to see if the policy's subdirectory exists.
                                        if (file.SubFolder) {
                                            var policyFolderPath = path.join(environmentRootPath, file.SubFolder);

                                            if (!fs.existsSync(policyFolderPath)) {
                                                fs.mkdirSync(policyFolderPath, { recursive: true });
                                            }
                                        }

                                        var filePath: string;

                                        // Save the  policy
                                        if (file.SubFolder) {
                                            filePath = path.join(policyFolderPath, file.FileName);
                                        } else {
                                            filePath = path.join(environmentRootPath, file.FileName);
                                        }

                                        fs.writeFile(filePath, policContent, 'utf8', (err) => {
                                            if (err) throw err;
                                        });

                                        hasBuiltAnyPolicies = true;
                                    });
                                }
                            });


                            if (hasBuiltAnyPolicies) {
                                if (singlePolicy) {
                                    vscode.window.showInformationMessage(`Your policy ${targetPolicy} successfully exported and stored under the Environment folder.`);
                                } else {
                                    vscode.window.showInformationMessage("Your policies successfully exported and stored under the Environment folder.");
                                }
                            } else {
                                vscode.window.showWarningMessage("It does not appear there were any policy files to build");
                            }
                        }
                    );
                }

            });
    };

    static GetAllSettings(): string[] {

        var items: string[] = [];

        var rootPath: string;
        // Check if a folder is opened
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

            // Add static settings
            items.push('{Settings:Tenant}');
            items.push('{Settings:Filename}');
            items.push('{Settings:PolicyFilename}');
            items.push('{Settings:Environment}');

            // Add the items from each environment
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
    public SubFolder: string;

    constructor(fileName: string, data: string) {
        this.Data = data;
        this.FileName = path.basename(fileName);
        this.SubFolder = this.GetSubFolder(fileName);
    }

    GetSubFolder(filePath: string): string {
        var relativePath = vscode.workspace.asRelativePath(filePath, false);
        var subFolder = relativePath.substring(0, relativePath.lastIndexOf('/'));

        if (!subFolder) {
            return null;
        }
        return subFolder;
    }

} 
