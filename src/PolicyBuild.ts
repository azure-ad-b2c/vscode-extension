import * as vscode from "vscode";
import fs = require("fs");
import path = require("path");
import Consts from "./Consts";
import { constants } from "os";
import { prependListener } from "cluster";
import { promises } from "dns";

export default class PolicyBuild {
	static readonly fBuildValues = "appsettings.json";
	static readonly = "EnvironmentsFolder";
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
		console.debug(`Searching for buildvalues in ${filePath}`);
		
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
						var buildValues: Object = JSON.parse(doc.getText());

						//Output-Folder
						let environmentsFolder = buildValues.hasOwnProperty(Consts.DefaultEnvironmentsFolder.key) && 
							!(!buildValues[Consts.DefaultEnvironmentsFolder.key]) //false for empty string, true for all else
							? buildValues[Consts.DefaultEnvironmentsFolder.key]
							: Consts.DefaultEnvironmentsFolder.value;
						
						let envresult = this.ResolveAndCreateFolder(environmentsFolder);
						if (envresult instanceof Error){console.debug("instanceof Error!")}

						// Policy-files-Folder
						let policiesFolder = buildValues.hasOwnProperty(Consts.DefaultPoliciesFolder.key) && 
							!(!buildValues[Consts.DefaultPoliciesFolder.key]) //false for empty string, true for all else
							? buildValues[Consts.DefaultPoliciesFolder.key]
							: Consts.DefaultPoliciesFolder.value;

						let result = this.ResolveAndCreateFolder(policiesFolder);
						if (result instanceof Error){console.debug("instanceof Error!")}
						
						console.debug(`Searching for policies in ${policiesFolder}`);
						console.debug(path.resolve(policiesFolder)); //TODO
						vscode.workspace
							.findFiles(
								new vscode.RelativePattern(
									policiesFolder,
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
											environmentsFolder,
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
											console.debug(`Written policy to ${environmentRootPath}\\${file.FileName}`);
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

	static ResolveAndCreateFolder = (folderPath: string): (void | Error) => {
		let rawPath = folderPath;
		folderPath = path.resolve(folderPath);
						if (!fs.existsSync(folderPath)) {
							if (path.isAbsolute(rawPath)){
								vscode.window.showWarningMessage(`Path "${rawPath}" is absolute, and thus not resolved relative to the workspace.
												Did you mean to have it relative? i.e no leading slash in "${Consts.DefaultEnvironmentsFolder.key}" in "${PolicyBuild.fBuildValues}"?`)
							}
							vscode.window.showQuickPick(["Yes", "No"], { placeHolder: `The folder "${rawPath}" does not exist, do you want to create it?`})
									.then((result) => {if (!result || result === "No") return Error;
										fs.mkdirSync(folderPath);
										console.debug(`Created folder ${folderPath}`);
									});
						}
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
