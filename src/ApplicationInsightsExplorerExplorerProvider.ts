import * as vscode from 'vscode';
import * as path from 'path';
import { ConfigurationTarget } from 'vscode';

class AppInsightsItem {
	Id: String;
	Tenant: String;
	UserJourney: String;
	OrchestrationStep: String;
	CorrelationId: String;
	Timestamp: String;
	Data: String;
	HasException: boolean;

	constructor(id: String, tenant: String, userJourney: String, orchestrationStep: String, correlationId: String, timestamp: String, data: String, hasException: boolean) {
		this.Id = id;
		this.Tenant = tenant;
		this.UserJourney = userJourney;
		this.OrchestrationStep = orchestrationStep;
		this.CorrelationId = correlationId;
		this.Timestamp = timestamp;
		this.Data = data;
		this.HasException = hasException;
	}
}

export default class ApplicationInsightsExplorerExplorerProvider implements vscode.TreeDataProvider<String> {

	_onDidChangeTreeData: vscode.EventEmitter<String | null> = new vscode.EventEmitter<String | null>();
	readonly onDidChangeTreeData: vscode.Event<String | null> = this._onDidChangeTreeData.event;

	editor: vscode.TextEditor;
	autoRefresh: boolean = false;
	AppInsightsItems: AppInsightsItem[] = [];
	panel;
	panelConfig;
	error: String = "";

	constructor(private context: vscode.ExtensionContext) {

		this.editor = vscode.window.activeTextEditor as vscode.TextEditor;
		vscode.window.onDidChangeActiveTextEditor(() => this.onActiveEditorChanged());
		this.parseTree();
		this.onActiveEditorChanged();
	}

	refresh(Initiator?: String): void {
		this.parseTree();
	}

	onActiveEditorChanged(): void {
		if ((this.panel && this.panel.visible) ||
			(this.panelConfig && this.panelConfig.visible) ||
			(vscode.window.activeTextEditor && vscode.window.activeTextEditor.document.uri.scheme === 'file' && vscode.window.activeTextEditor.document.languageId === 'xml')) {
			vscode.commands.executeCommand('setContext', 'CustomPolicyExplorerEnabled', true);
		}
		else {
			vscode.commands.executeCommand('setContext', 'CustomPolicyExplorerEnabled', false);
		}
	}

	parseTree(): void {
		this.error = 'loading';

		var request = require('request');

		// Check the configuration
		var config = vscode.workspace.getConfiguration('aadb2c.ai');

		if (!config || (!config.id && !config.key))
			this.error = "Application insights configuration not found";
		else if (!config.id)
			this.error = "Application insights Id not found";
		else if (!config.key)
			this.error = "Application insights Key not found";

		if (this.error && this.error != 'loading') {
			this._onDidChangeTreeData.fire(null)
			return;
		}
		else if (this.error && this.error == 'loading') {
			this._onDidChangeTreeData.fire(null)
		}

		// Prepare the Application insights call
		var options = {
			url: 'https://api.applicationinsights.io/v1/apps/' + config.id + '/events/traces?$top=' + config.maxRows + '&$orderby=timestamp desc&$select=id,timestamp,trace/message,customDimensions',
			headers: {
				'X-API-Key': config.key
			}
		};

		// Application insights call-back function
		function callback(this: ApplicationInsightsExplorerExplorerProvider, error, response, body) {
			if (!error && response.statusCode == 200) {
				this.error = "";
				body = body.replace('""', '"');
				var info = JSON.parse(body);

				this.AppInsightsItems = [];
				for (var i = 0; i < info.value.length; i++) {
					var element = info.value[i];
					
					// Find the orchestration steps
					var startIndex = 0, index, currentStep = '';
					while ((index = element.trace.message.indexOf('CurrentStep', startIndex)) > -1) {
						startIndex = index + 'CurrentStep'.length;
						index = element.trace.message.indexOf(':', index);
						var endOfRaw = element.trace.message.indexOf('\r\n', index);
						currentStep += element.trace.message.substring(index + 1, endOfRaw).trim() + ', ';
					}

					if (currentStep.length > 1)
					{
						currentStep = "Step " + currentStep.substr(0, currentStep.length-2);
					}

					this.AppInsightsItems.push(new AppInsightsItem(
						info.value[i].id,
						info.value[i].customDimensions.Tenant,
						info.value[i].customDimensions.UserJourney,
						currentStep,
						info.value[i].customDimensions.CorrelationId,
						info.value[i].timestamp,
						element.trace.message,
						(element.trace.message.indexOf('Exception') > 0)
					));
				}

				this._onDidChangeTreeData.fire(null)
			}
			else if (response.statusCode == 404) {
				vscode.window.showErrorMessage("Wrong Application insights Id");
				this.error = "Wrong Application insights Id";
				this._onDidChangeTreeData.fire(null);
			}
			else if (response.statusCode == 403) {
				vscode.window.showErrorMessage("The provided credentials have insufficient access to perform the requested operation. Check your application key.");
				this.error = "The provided credentials have insufficient access to perform the requested operation. Check your application key.";
				this._onDidChangeTreeData.fire(null);
			} else {
				vscode.window.showErrorMessage(body);
				this.error = "General error";
				this._onDidChangeTreeData.fire(null);
			}
		}

		// CallApplication insights REST API endpoint
		request(options, callback.bind(this));
	}


	getChildren(parentElementKey?: String): Thenable<String[]> {
		const keys: String[] = [];

		if (this.error != "" && this.error != "loading") {
			keys.push("Error|" + this.error);
		}
		else if (this.error != "" && this.error == "loading") {
			keys.push("Error|Loading...");
		}
		else if (this.AppInsightsItems.length == 0) {
			keys.push("Error|Application Insights produced empty result from the last 12 hours.");
		}
		else {
			if (!parentElementKey) {
				// Load the root elements (user journeys)
				var distinct: String[] = [];
				for (var i = 0; i < this.AppInsightsItems.length; i++) {
					var userJourney = this.AppInsightsItems[i].UserJourney;
					if (distinct.indexOf(userJourney) > (-1)) continue;
					{
						distinct.push(userJourney);
						keys.push("UserJourney|" + userJourney);
					}
				}
				keys.sort();
			}
			else {
				const elementValues: String[] = parentElementKey.split("|");

				// Load the root elements' children
				if (elementValues[0] == "UserJourney") {

					// Load the list of correction IDs
					var distinct: String[] = [];
					for (var i = 0; i < this.AppInsightsItems.length; i++) {

						var correlationId = this.AppInsightsItems[i].CorrelationId;

						if (elementValues[1] != this.AppInsightsItems[i].UserJourney ||
							distinct.indexOf(correlationId) > (-1)) continue;
						{
							distinct.push(correlationId);

							// Get the first data and time of this correlation id
							var minTimestamp;
							for (var x = 0; x < this.AppInsightsItems.length; x++) {
								if (this.AppInsightsItems[x].CorrelationId != correlationId) continue;
								{
									var timestamp = new Date(Date.parse(this.AppInsightsItems[x].Timestamp.toString()));
									if (!minTimestamp || timestamp < minTimestamp)
										minTimestamp = timestamp;
								}
							}
							keys.push("CorrelationId|" + this.formatDate(minTimestamp) + " (" + correlationId.split("-")[0] + ")|" + correlationId);
						}
					}
					keys.sort().reverse();
				}
				else if (elementValues[0] == "CorrelationId") {
					// Load the list of orchestration steps
					for (var i = 0; i < this.AppInsightsItems.length; i++) {
						var correlationId = this.AppInsightsItems[i].CorrelationId;
						if (elementValues[2] != correlationId) continue;
						{
							var timestamp = new Date(Date.parse(this.AppInsightsItems[i].Timestamp.toString()));
							var setp = this.AppInsightsItems[i].OrchestrationStep ? " (" + this.AppInsightsItems[i].OrchestrationStep + ")" : "";
							keys.push("OrchestrationStep|" + this.formatDate(timestamp) + setp + "|" + this.AppInsightsItems[i].Id + "|" + this.AppInsightsItems[i].HasException);
						}
					}
					keys.sort();
				}
			}
			
		}

		return Promise.resolve(keys);
	}

	formatDate(date: Date) {
		return date.getFullYear().toString() + "-" + this.pad(date.getMonth()) + "-" + this.pad(date.getDate()) + " " + this.pad(date.getHours()) + ":" + this.pad(date.getMinutes()) + ":" + this.pad(date.getSeconds());
	}
	pad(date: number) {
		return date.toString().length < 2 ? "0" + date : date;
	}

	getTreeItem(elementKey: String): vscode.TreeItem {

		let treeItem: vscode.TreeItem;
		const elementValues: String[] = elementKey.split("|");

		if (elementValues[0] == "UserJourney") {
			treeItem = new vscode.TreeItem(elementValues[1] as string, vscode.TreeItemCollapsibleState.Expanded);
		}
		else if (elementValues[0] == "CorrelationId") {
			treeItem = new vscode.TreeItem(elementValues[1] as string, vscode.TreeItemCollapsibleState.Collapsed);
		}
		else if (elementValues[0] == "Error") {
			treeItem = new vscode.TreeItem(elementValues[1] as string, vscode.TreeItemCollapsibleState.None);
			treeItem.iconPath = this.getIcon("warning.svg");
		}
		else {

			treeItem = new vscode.TreeItem(elementValues[1] as string, vscode.TreeItemCollapsibleState.None);

			treeItem.command = {
				command: 'ApplicationInsightsExplorer.show',
				title: '',
				arguments: [elementValues[2]]
			};

			if (elementValues[3] === 'true') {
				treeItem.iconPath = this.getIcon("warning.svg");
			}
		}

		return treeItem;
	}

	getIcon(fileName: String): any {
		return {
			light: this.context.asAbsolutePath(path.join('resources', 'light', fileName.toString())),
			dark: this.context.asAbsolutePath(path.join('resources', 'dark', fileName.toString()))
		}
	}

	show(id: String) {

		for (var i = 0; i < this.AppInsightsItems.length; i++) {
			if (id != this.AppInsightsItems[i].Id) continue;
			{
				if (!this.panel)
					this.panel = vscode.window.createWebviewPanel('ApplicationInsightsData', "Application Insights Explorer", vscode.ViewColumn.One, {});

				this.panel.onDidDispose(() => {
					// When the panel is closed, cancel any future updates to the webview content
					this.panel = null;
				}, null, null);

				// And set its HTML content
				this.panel.webview.html = this.getWebviewContent(this.AppInsightsItems[i]);
				this.panel.reveal();
				this.panel.onDidChangeViewState((e) => {
					if (e.webviewPanel._visible) {
						vscode.commands.executeCommand('setContext', 'CustomPolicyExplorerEnabled', true);
					}
				})
				break;
			}
		}
	}

	getWebviewContent(item: AppInsightsItem) {
		return `<!DOCTYPE html>
	<html lang="en">
	<head>
		<meta charset="UTF-8">
		<meta name="viewport" content="width=device-width, initial-scale=1.0">
		<title>Application Insights Explorer</title>
	<style>
		body.vscode-light {
			color: black;
		}
		
		body.vscode-dark {
			color: white;
		}
		
		body.vscode-high-contrast {
			color: red;
		}
	</style>
	</head>
	<body>
		<ul>
  			<li><b>User Journey</b>: ` + item.UserJourney + `</li>
  			<li><b>Correlation Id</b>: ` + item.CorrelationId + `</li>
			<li><b>Orchestration Step</b>: ` + item.OrchestrationStep + `</li>
			<li><b>App insights Id</b>: ` + item.Id + `</li>
			<li><b>App insights timestamp</b>: ` + item.Timestamp + `</li>
		</ul>

		<textarea type="text"  name="txtarea" style="width:100%;height:100vw">
		` + item.Data + `
		</textarea>
		
	</body>
	</html>`;
	}

	settings() {

		if (!this.panelConfig)
			this.panelConfig = vscode.window.createWebviewPanel('ApplicationInsightsSettings', "Application Insights Settings", vscode.ViewColumn.One, {
				// Enable scripts in the webview
				enableScripts: true
			});

		// Handle messages from the webview
		this.panelConfig.webview.onDidReceiveMessage(message => {

			// Load the configuration
			var config = vscode.workspace.getConfiguration('aadb2c.ai');

			var configurationTarget: ConfigurationTarget = ConfigurationTarget.Workspace;
			// Run this code only if user open a directory workspace
			if (!vscode.workspace.rootPath) {
				configurationTarget = ConfigurationTarget.Global;
			}

			config.update("id", message.id, configurationTarget);
			config.update("key", message.key, configurationTarget);
			config.update("maxRows", Number(message.maxRows), configurationTarget);
			this.panelConfig.dispose();

			// Trick, place a delay and the values get loaded
			setTimeout(() => this.refresh(), 2500);

		}, undefined, undefined);

		this.panelConfig.onDidDispose(() => {
			// When the panel is closed, cancel any future updates to the webview content
			this.panelConfig = null;
		}, null, null);

		// And set its HTML content
		this.panelConfig.webview.html = this.getSettingsWebviewContent();
		this.panelConfig.reveal();
	}

	getSettingsWebviewContent() {

		// Load the configuration
		var config = vscode.workspace.getConfiguration('aadb2c.ai');
		var targetConfigFile: String = "";
		var title: String;

		if (vscode.workspace.rootPath) {
			title = "Application Insights Settings (workspace)";
			targetConfigFile = "<b>Workspace folder</b> settings file is located here:<br />" + path.join(vscode.workspace.rootPath, ".vscode", "settings.json");
		}
		else {
			title = "Application Insights Settings (global)";
			targetConfigFile = `Depending on your platform, the <b>global</b> user settings file is located here:
			<ul>
				<li><b>Windows</b> %APPDATA%\\Code\\User\\settings.json</li>
				<li><b>macOS</b> $HOME/Library/Application Support/Code/User/settings.json</li>
				<li><b>Linux</b> $HOME/.config/Code/User/settings.json</li>
			</ul>`;
		}

		return `<!DOCTYPE html>
	<html lang="en">
	<head>
		<meta charset="UTF-8">
		<meta name="viewport" content="width=device-width, initial-scale=1.0">
		<title>Application Insights Explorer</title>
	<style>
		body.vscode-light {
			color: black;
		}
		
		body.vscode-dark {
			color: white;
		}
		
		body.vscode-high-contrast {
			color: red;
		}
	</style>
	<script>
		function save() {
			const vscode = acquireVsCodeApi();
			const id = document.getElementById('id');
			const key = document.getElementById('key');
			const maxRows = document.getElementById('maxRows');

			vscode.postMessage({
				id: id.value,
				key: key.value, 
				maxRows: maxRows.value, 
			})
		}
	</script>	
	</head>
	<body>
		<H1>` + title + `</h3>

		<a href="https://github.com/yoelhor/aad-b2c-vs-code-extension/blob/master/src/help/app-insights.md">Click here to learn how to configure Application insights</a><br />&nbsp;

		<table>
		<tr>
			<td>Your Application ID</td>
			<td><input type="text" id="id" value="` + config.id + `"></td>
		</tr>
		<tr>
			<td>Your Application key</td>
			<td><input type="text" id="key" value="` + config.key + `"></td>
		</tr>
		<tr>
			<td>The number of events to return</td>
			<td><input type="number" id="maxRows" value="` + config.maxRows + `"  min="1" max="50"></td>
		</tr>
		<tr>
			<td></td>
			<td><input type="button" onclick="save()" id="save" value="Save"></td>
		</tr>
		</table>

		<H2>Settings file locations</H2>
		` + targetConfigFile + `

	</body>
	</html>`;
	}


}