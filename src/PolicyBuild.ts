import * as vscode from "vscode";
import fs = require("fs");
import path = require("path");
import Consts from "./Consts";
import { constants } from "os";
import { prependListener } from "cluster";
import { promises } from "dns";

export default class PolicyBuild {
	static readonly fBuildValues = "appsettings.json";
	static readonly  = "EnvironmentsFolder";
	static Build() {
		// Check if a folder is opened
		if (
			!vscode.workspace.workspaceFolders ||
			vscode.workspace.workspaceFolders.length == 0
		) {
			vscode.window.showWarningMessage(
				"To build a policy you need to open the policy folder in VS code"
			);
			return;
		}

		var rootPath: string = vscode.workspace.workspaceFolders[0].uri.fsPath;
		var filePath = path.join(rootPath, this.fBuildValues);
        console.debug(`Searching for buildvalues in ${filePath}`)
		vscode.workspace
			.findFiles(
				new vscode.RelativePattern(
					vscode.workspace.rootPath as string,
					`${this.fBuildValues}`
				)
			)
			.then((uris) => {
				if (!uris || uris.length == 0) {
					vscode.window
						.showQuickPick(["Yes", "No"], {
							placeHolder: `The ${this.fBuildValues} file is missing, do you want to create it?`,
						})
						.then((result) => {
							if (!result || result === "No") return;

							// Create app settings file with default values
							fs.writeFile(
								filePath,
								Consts.DefaultDeploymentSettings,
								"utf8",
								(err) => {
									if (err) throw err;
									vscode.workspace.openTextDocument(filePath).then((doc) => {
										vscode.window.showTextDocument(doc);
									});
								}
							);
						});
				} else {
					vscode.workspace.openTextDocument(filePath).then((doc) => {
						var buildValues : Object = JSON.parse(doc.getText());

						let environmentsFolder = buildValues.hasOwnProperty(Consts.DefaultEnvironmentsFolder.key)
							? buildValues[Consts.DefaultEnvironmentsFolder.key]
							: Consts.DefaultPoliciesFolder.value;
						var environmentsFolderPath = environmentsFolder;
						if( !path.isAbsolute(environmentsFolderPath)){
							environmentsFolderPath = path.join(
								rootPath, 
								environmentsFolder
							);
						} else {
							vscode.window.showErrorMessage(`"${Consts.DefaultEnvironmentsFolder.key}" in "${this.fBuildValues}" has to be a relative path, i.e. no leading slash`);
							return;
						}

						// Ensure environments folder exists
						if (!fs.existsSync(environmentsFolderPath)) {
							fs.mkdirSync(environmentsFolderPath);
						}

						// Is location of policy-files specified?
						let policiesFolder = buildValues.hasOwnProperty(Consts.DefaultPoliciesFolder.key)
							? buildValues[Consts.DefaultPoliciesFolder.key]
							: Consts.DefaultPoliciesFolder.value;

						// Absolute = 'C:\path\to\somewhere' || /path/to/somewhere
						// Relative = path/to/somewhere
						var policyFilesFolderPath = policiesFolder;
						if( !path.isAbsolute(policiesFolder)){
							policyFilesFolderPath = path.join(
								rootPath,
								policiesFolder
							);	
						}

						policyFilesFolderPath = path.resolve(policyFilesFolderPath);
						// Does folder, specified to contain policies, exist?
						if ( !fs.existsSync(policyFilesFolderPath)) {
							if(path.isAbsolute(policyFilesFolderPath)) {
								vscode.window.showWarningMessage(`Path "${policyFilesFolderPath}" is absolute, and thus not resolved relative to the workspace.
																Did you mean to have it relative? i.e no leading slash in "${Consts.DefaultEnvironmentsFolder.key}" in "${this.fBuildValues}"?`)
							}
							vscode.window.showErrorMessage(`Folder specified by "${Consts.DefaultPoliciesFolder.key}" in "${this.fBuildValues}" does not exist. 
															Expecting folder at "${policyFilesFolderPath}"` );
							return;
						}
						
					vscode.workspace
						.findFiles(
							new vscode.RelativePattern(
								policyFilesFolderPath,
								"*.{xml}"
							)
						)
						.then((uris) => {
							let policyFiles: PolicyFile[] = [];
							uris.forEach((uri) => {
								if (uri.fsPath.indexOf("?") <= 0) {
									var data = fs.readFileSync(uri.fsPath, "utf8");
									policyFiles.push(
										new PolicyFile(path.basename(uri.fsPath), data.toString())
									);
								}
							});

							return policyFiles;
						})
						.then((policyFiles) => {
							// Iterate through environments
							buildValues["Environments"].forEach(function (entry) {
								if (entry.PolicySettings == null) {
									vscode.window.showErrorMessage(
										"Can't generate '" +
											entry.Name +
											"' environment policies. Error: Accepted PolicySettings element is missing. You may use old version of the appSettings.json file. For more information, see [App Settings](https://github.com/yoelhor/aad-b2c-vs-code-extension/blob/master/README.md#app-settings)"
									);
								} else {
									var environmentRootPath = path.join(
										environmentsFolderPath,
										entry.Name
									);

									// Ensure environment folder exists
									if (!fs.existsSync(environmentRootPath)) {
										fs.mkdirSync(environmentRootPath);
									}

									// Iterate through the list of settings
									policyFiles.forEach(function (file) {
										var policContent = file.Data;

										// Replace the tenant name
										policContent = policContent.replace(
											new RegExp("{Settings:Tenant" + "}", "g"),
											entry.Tenant
										);

										// Replace the rest of the policy settings
										Object.keys(entry.PolicySettings).forEach((key) => {
											policContent = policContent.replace(
												new RegExp("{Settings:" + key + "}", "g"),
												entry.PolicySettings[key]
											);
										});

										// Save the  policy
										fs.writeFile(
											path.join(environmentRootPath, file.FileName),
											policContent,
											"utf8",
											(err) => {
												if (err) throw err;
											}
										);
									});

									vscode.window.showInformationMessage(
										"You policies successfully exported and stored under the Environment folder."
									);
								}
							});
						});
					});
				}
			});
	}

	static GetAllSettings(): string[] {
		var items: string[] = [];

		var rootPath: string;
		// Check if a folder is opend
		if (
			!vscode.workspace.workspaceFolders ||
			vscode.workspace.workspaceFolders.length == 0
		) {
			return items;
		}

		// Get the app settings file path
		rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
		var filePath = path.join(rootPath, this.fBuildValues);

		// Check if file exists
		if (fs.existsSync(filePath)) {
			var fileContent = fs.readFileSync(filePath, "utf8");
			var appSettings = JSON.parse(fileContent);

			// Add the items from each environment
			items.push("{Settings:Tenant}");

			appSettings.Environments.forEach(function (entry) {
				// Replace the rest of the policy settings
				Object.keys(entry.PolicySettings).forEach((key) => {
					if (items.indexOf("{Settings:" + key + "}") == -1) {
						items.push("{Settings:" + key + "}");
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
